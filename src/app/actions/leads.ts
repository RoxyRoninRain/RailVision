'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Lead } from './types';
import { Resend } from 'resend';
import { detectImageMetadata, isSafeExternalUrl, isValidUuid } from '@/lib/validations';
import { checkRateLimit, extractClientIp } from '@/lib/rate-limit';

const resend = new Resend(process.env.RESEND_API_KEY);

const ALLOWED_UPLOAD_MIME_MAP: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

// Public submission
export async function trackDownload(formData: FormData) {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const rawOrgId = (formData.get('organization_id') as string)?.trim();
    const orgId = rawOrgId && isValidUuid(rawOrgId) ? rawOrgId : '';

    // --- IP SECURITY & RATE LIMIT CHECK ---
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const clientIp = extractClientIp(headersList);

    const rl = checkRateLimit('track-download', clientIp, 20, 15 * 60 * 1000);
    if (!rl.allowed) {
        return { success: false, error: 'Too many download requests. Please try again later.' };
    }

    // --- SUBSCRIPTION CHECK ---
    if (orgId) {
        const { getTenantProfile } = await import('@/app/actions/profile');
        const profile = await getTenantProfile(orgId);
        if (profile && profile.subscription_status !== 'active' && profile.subscription_status !== 'trialing') {
            return { success: false, error: 'Service Unavailable' };
        }
    }

    const styleName = ((formData.get('style_name') as string) || 'Unknown').slice(0, 150);
    let generatedUrl = formData.get('generated_design_url') as string;

    const { checkIpStatus } = await import('@/app/admin/actions/security');
    const ipStatus = await checkIpStatus(clientIp, orgId || undefined);

    if (ipStatus.blocked) {
        console.warn(`[SECURITY] Blocked IP Download attempt: ${clientIp} for Tenant ${orgId}`);
        return { success: false, error: 'Access Denied: Your IP address has been blocked.' };
    }
    // -------------------------

    // --- HANDLE BASE64 IMAGE UPLOAD ---
    if (generatedUrl && generatedUrl.startsWith('data:image')) {
        try {
            const matches = generatedUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const base64Data = matches[2];
                const buffer = Buffer.from(base64Data, 'base64');
                const meta = detectImageMetadata(buffer);
                if (buffer.byteLength <= 15 * 1024 * 1024 && meta.valid && meta.mimeType && meta.mimeType !== 'image/heic' && meta.ext) {
                    const fileName = `downloads/${orgId || 'public'}/${Date.now()}-${Math.random().toString(36).substring(7)}.${meta.ext}`;

                    const { error: uploadError } = await (adminSupabase || supabase).storage
                        .from('quote-uploads')
                        .upload(fileName, buffer, {
                            contentType: meta.mimeType
                        });

                    if (!uploadError) {
                        const { data: { publicUrl } } = (adminSupabase || supabase).storage
                            .from('quote-uploads')
                            .getPublicUrl(fileName);

                        generatedUrl = publicUrl;
                    } else {
                        console.error('[TrackDownload] Image upload failed:', uploadError);
                        generatedUrl = '';
                    }
                } else {
                    generatedUrl = '';
                }
            } else {
                generatedUrl = '';
            }
        } catch (e) {
            console.error('[TrackDownload] Image processing error:', e);
            generatedUrl = '';
        }
    } else if (generatedUrl && !isSafeExternalUrl(generatedUrl)) {
        generatedUrl = '';
    }

    const payload: Record<string, any> = {
        organization_id: orgId || null,
        style_name: styleName || 'Unknown',
        generated_design_url: generatedUrl,
        customer_name: 'Design Download',
        email: 'download@anonymous', // Differentiator
        status: 'Download', // New Categorization
        ip_address: clientIp,
        created_at: new Date().toISOString()
    };

    // Use Admin Client to ensure insert permissions (guests might have limited RLS)
    const dbClient = adminSupabase || supabase;

    const { error } = await dbClient
        .from('leads')
        .insert([payload]);

    if (error) {
        console.error('Track Download Error:', error);
        return { success: false, error: 'Unable to record download.' };
    }

    return { success: true };
}

export async function submitLead(formData: FormData) {
    const supabase = await createClient(); // Use server client
    const adminSupabase = createAdminClient(); // Admin client for storage/inserts

    const rawOrgId = (formData.get('organization_id') as string)?.trim();
    const orgId = rawOrgId && isValidUuid(rawOrgId) ? rawOrgId : '';

    // --- IP SECURITY & RATE LIMIT CHECK ---
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const clientIp = extractClientIp(headersList);

    const rl = checkRateLimit('submit-lead', clientIp, 10, 15 * 60 * 1000);
    if (!rl.allowed) {
        return { success: false, error: 'Too many quote requests submitted recently. Please wait a few minutes and try again.' };
    }

    const { checkIpStatus } = await import('@/app/admin/actions/security');
    const ipStatus = await checkIpStatus(clientIp, orgId || undefined);

    if (ipStatus.blocked) {
        console.warn(`[SECURITY] Blocked IP Lead submission attempt: ${clientIp} for Tenant ${orgId}`);
        return { success: false, error: 'Access Denied: Your IP address has been blocked.' };
    }
    // -------------------------

    // --- SUBSCRIPTION CHECK ---
    if (orgId) {
        const { getTenantProfile } = await import('@/app/actions/profile');
        const profile = await getTenantProfile(orgId);
        if (profile && profile.subscription_status !== 'active' && profile.subscription_status !== 'trialing') {
            return { success: false, error: 'Service Unavailable: The account associated with this tool is not currently active.' };
        }
    }

    // Extract Form Data
    const escapeHtml = (str: string | null | undefined): string => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    const email = (formData.get('email') as string)?.trim();
    const customer_name = escapeHtml(formData.get('customer_name') as string) || 'Guest';
    const styleName = formData.get('style_name') as string;
    const safeStyleName = escapeHtml(styleName || 'Custom');
    let generatedUrl = formData.get('generated_design_url') as string;
    const phone = escapeHtml(formData.get('phone') as string);
    const message = escapeHtml(formData.get('message') as string);
    let estimate_json: any = null;
    if (formData.get('estimate_json')) {
        try {
            estimate_json = JSON.parse(formData.get('estimate_json') as string);
        } catch {
            estimate_json = null;
        }
    }

    // File Uploads
    const files = (formData.getAll('files') as File[]).slice(0, 5);
    const attachmentUrls: string[] = [];
    const uploadErrors: string[] = [];

    // --- HANDLE BASE64 GENERATED IMAGE START ---
    // If the generated URL is a Base64 string (from Nano Banana), upload it to Storage
    if (generatedUrl && generatedUrl.startsWith('data:image')) {
        try {
            console.log('[Upload Debug] Found Base64 generated image. Uploading to Storage...');
            const matches = generatedUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);

            if (matches && matches.length === 3) {
                const base64Data = matches[2];
                const buffer = Buffer.from(base64Data, 'base64');
                const meta = detectImageMetadata(buffer);
                if (buffer.byteLength <= 15 * 1024 * 1024 && meta.valid && meta.mimeType && meta.mimeType !== 'image/heic' && meta.ext) {
                    const fileName = `generated/${orgId || 'public'}/${Date.now()}-${Math.random().toString(36).substring(7)}.${meta.ext}`;

                    const { error: uploadError } = await (adminSupabase || supabase).storage
                        .from('quote-uploads')
                        .upload(fileName, buffer, {
                            contentType: meta.mimeType
                        });

                    if (!uploadError) {
                        const { data: { publicUrl } } = (adminSupabase || supabase).storage
                            .from('quote-uploads')
                            .getPublicUrl(fileName);

                        generatedUrl = publicUrl;
                    } else {
                        console.error('[Upload Debug] Failed to upload generated image:', uploadError);
                        uploadErrors.push('Failed to save generated design.');
                        generatedUrl = '';
                    }
                } else {
                    generatedUrl = '';
                }
            } else {
                generatedUrl = '';
            }
        } catch (e) {
            console.error('[Upload Debug] Exception uploading generated image:', e);
            generatedUrl = '';
        }
    } else if (generatedUrl && !isSafeExternalUrl(generatedUrl)) {
        generatedUrl = '';
    }
    // --- HANDLE BASE64 GENERATED IMAGE END ---

    if (!email) {
        return { success: false, error: 'Email is required' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
        return { success: false, error: 'Invalid email format' };
    }

    // 1. Handle File Uploads
    if (files.length > 0) {
        console.log(`[Upload Debug] Received ${files.length} files`);
        for (const file of files) {
            console.log(`[Upload Debug] Processing ${file.name}, size: ${file.size}`);

            // Strict validation: Max 15MB & raster images only
            if (file.size > 15 * 1024 * 1024) {
                uploadErrors.push(`${file.name} too large (max 15MB)`);
                continue;
            }

            const safeExt = ALLOWED_UPLOAD_MIME_MAP[file.type];
            if (!safeExt) {
                uploadErrors.push(`${file.name} has unsupported file type`);
                continue;
            }

            const fileBuffer = Buffer.from(await file.arrayBuffer());
            const fileMeta = detectImageMetadata(fileBuffer);
            if (!fileMeta.valid || !fileMeta.mimeType || fileMeta.mimeType === 'image/heic' || !fileMeta.ext) {
                uploadErrors.push(`${file.name} failed image verification`);
                continue;
            }

            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileMeta.ext}`;
            const filePath = `${orgId || 'public'}/${fileName}`;

            // Use Admin Client for file uploads too, to ensure guests can upload
            const { error: uploadError } = await (adminSupabase || supabase).storage
                .from('quote-uploads')
                .upload(filePath, fileBuffer, { contentType: fileMeta.mimeType });

            if (!uploadError) {
                const { data: { publicUrl } } = (adminSupabase || supabase).storage
                    .from('quote-uploads')
                    .getPublicUrl(filePath);
                attachmentUrls.push(publicUrl);
            } else {
                console.error("File upload failed:", uploadError);
                uploadErrors.push(`Upload failed for ${file.name}: ${uploadError.message}`);
            }
        }
    }

    const payload: any = {
        email,
        customer_name,
        style_name: styleName || 'Custom',
        generated_design_url: generatedUrl,
        phone,
        message,
        estimate_json,
        attachments: attachmentUrls,
        status: 'New',
        created_at: new Date().toISOString()
    };

    if (orgId) {
        payload.organization_id = orgId;
    }

    // Insert
    const dbClient = adminSupabase || supabase;

    const { error } = await dbClient
        .from('leads')
        .insert([payload]);

    if (error) {
        console.error('Supabase Error:', error);
        return { success: false, error: 'Database error' };
    }

    // Log quote creation without customer PII
    console.log(`[Notification] New Quote Request recorded for Tenant ${orgId || 'Generic'}`);

    // --- EMAIL NOTIFICATIONS START ---
    console.log(`[Email Debug] Attempting to send. OrgId: ${orgId ? 'Present' : 'Missing'}, Key: ${process.env.RESEND_API_KEY ? 'Present' : 'Missing'}`);

    if (orgId && process.env.RESEND_API_KEY) {
        try {
            // Use Admin Client to bypass RLS for Profile Read

            if (!adminSupabase) console.error('[Email Debug] Failed to create Admin Client');

            if (adminSupabase) {
                // 1. Fetch Tenant Profile & Settings
                const { data: tenantProfile, error: profileError } = await adminSupabase
                    .from('profiles')
                    .select('email, shop_name, confirmation_email_body')
                    .eq('id', orgId)
                    .single();

                if (profileError) {
                    console.error("Failed to fetch tenant profile:", profileError);
                } else if (tenantProfile?.email) {
                    const safeEmail = escapeHtml(email);
                    const safeShopName = escapeHtml(tenantProfile.shop_name || 'Railify');
                    const safeEstimateJson = estimate_json ? escapeHtml(JSON.stringify(estimate_json, null, 2)) : '';

                    // Email 1: To Tenant (New Lead Alert)
                    const { error: emailError } = await resend.emails.send({
                        from: 'Railify <notifications@railify.app>',
                        to: tenantProfile.email,
                        subject: `New Quote Request: ${customer_name}`,
                        html: `
                        <div style="font-family: sans-serif; color: #333;">
                            <h2>New Logic/Quote Request</h2>
                            <p><strong>Customer:</strong> ${customer_name}</p>
                            <p><strong>Email:</strong> ${safeEmail}</p>
                            <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
                            <p><strong>Style:</strong> ${safeStyleName}</p>
                            <p><strong>Message:</strong><br/>${message ? message.replace(/\n/g, '<br/>') : 'No message'}</p>
                            
                            ${safeEstimateJson ? `
                                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                    <h3>Estimate Details</h3>
                                    <pre style="margin: 0;">${safeEstimateJson}</pre>
                                </div>
                            ` : ''}

                             ${(generatedUrl || attachmentUrls.length > 0) ? `
                                <div style="margin-top: 20px; display: flex; gap: 20px; flex-wrap: wrap;">
                                    ${attachmentUrls.length > 0 ? `
                                        <div style="margin-right: 16px;">
                                            <p><strong>Original Staircase (Before):</strong></p>
                                            <img src="${escapeHtml(attachmentUrls[0])}" alt="Original Staircase" style="max-width: 280px; border-radius: 8px; border: 1px solid #ddd;" />
                                            <p><a href="${escapeHtml(attachmentUrls[0])}">View Full Original Photo</a></p>
                                        </div>
                                    ` : ''}
                                    ${generatedUrl ? `
                                        <div>
                                            <p><strong>Generated Design (After):</strong></p>
                                            <img src="${escapeHtml(generatedUrl)}" alt="Design" style="max-width: 280px; border-radius: 8px; border: 1px solid #ddd;" />
                                            <p><a href="${escapeHtml(generatedUrl)}">View Full Generated Design</a></p>
                                        </div>
                                    ` : ''}
                                </div>
                            ` : ''}

                            ${attachmentUrls.length > 1 ? `
                                <div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 12px;">
                                    <p><strong>All Customer Uploads (${attachmentUrls.length}):</strong></p>
                                    <ul>
                                        ${attachmentUrls.map((url, idx) => `<li><a href="${escapeHtml(url)}">View Photo ${idx + 1}</a></li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                            
                            <hr/>
                            <p style="font-size: 12px; color: #888;">Powered by Railify</p>
                        </div>
                    `
                    });

                    if (emailError) {
                        console.error("[Email Debug] Resend API Error:", JSON.stringify(emailError));
                    } else {
                        console.log(`[Email Debug] Success. Lead notification email sent to tenant ${orgId}`);
                    }

                    // Email 2: To Customer (Confirmation)
                    const rawConfirmationBody = tenantProfile.confirmation_email_body ||
                        "Thank you for your request! We have received your details and will be reviewing your project shortly. Expect to hear from us within 1-2 business days with a formal quote.";
                    const safeConfirmationBody = escapeHtml(rawConfirmationBody);
                    const cleanFromName = (tenantProfile.shop_name || 'Railify').replace(/[<>"]/g, '');

                    const { error: customerEmailError } = await resend.emails.send({
                        from: `${cleanFromName} <notifications@railify.app>`,
                        to: email, // Customer email
                        replyTo: tenantProfile.email, // Replies go to Tenant
                        subject: `We received your request! - ${tenantProfile.shop_name || 'Railify'}`,
                        html: `
                        <div style="font-family: sans-serif; color: #333;">
                            <h2>Hello ${customer_name},</h2>
                            <p>${safeConfirmationBody.replace(/\n/g, '<br/>')}</p>
                            <br/>
                            <p><strong>Your Project Summary:</strong></p>
                            <ul>
                                <li>Style: ${safeStyleName}</li>
                                ${estimate_json && estimate_json.min ? `<li>Est. Price: $${escapeHtml(String(estimate_json.min))} - $${escapeHtml(String(estimate_json.max))}</li>` : ''}
                            </ul>
                            <br/>
                            <p>Best regards,</p>
                            <p><strong>${safeShopName}</strong></p>
                        </div>
                        `
                    });

                    if (customerEmailError) {
                        console.error("[Email Debug] Customer Confirmation Failed:", customerEmailError);
                    } else {
                        console.log(`[Email Debug] Customer confirmation email dispatched`);
                    }

                } else {
                    console.warn(`No email found for tenant ${orgId}`);
                }
            }
        } catch (emailErr) {
            console.error("Email dispatch error:", emailErr);
        }
    }
    // --- EMAIL NOTIFICATION END ---

    return { success: true, warnings: uploadErrors };
}



export async function getOwnerLeads(limit: number = 100, statusFilter?: string): Promise<Lead[]> {
    const { getActingUser } = await import('@/lib/auth-context');
    const { user, tenantId, supabase: actingSupabase } = await getActingUser();

    if (!user) return [];

    console.log(`[DEBUG] getOwnerLeads: Fetching leads. Limit: ${limit}, Status: ${statusFilter}`);

    let query = actingSupabase
        .from('leads')
        .select(`
          id, created_at, email, customer_name, status, style_name, organization_id, generated_design_url, estimate_json, attachments,
          portfolio ( name )
        `)
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (statusFilter && statusFilter !== 'All') {
        if (statusFilter === 'Active') {
            query = query.in('status', ['New', 'Pending', 'Contacted']);
        } else {
            query = query.eq('status', statusFilter);
        }
    }

    const { data, error } = await query;

    if (error) {
        console.error('Get Owner Leads Error:', error);
        return [];
    }

    const leads = data.map((lead: any) => {
        // Light safeguard: Prune massive URLs if they appear again (prevents crash, but doesn't db-write)
        let designUrl = lead.generated_design_url;
        if (designUrl && designUrl.length > 50000) { // 50KB limit (Safe for URL, prevents Base64)
            console.warn(`[PRUNED] Lead ${lead.id} has massive generated_design_url. Hiding.`);
            designUrl = undefined;
        }

        return {
            id: lead.id,
            email: lead.email,
            customer_name: lead.customer_name || 'Unknown',
            status: lead.status || 'New',
            created_at: lead.created_at,
            style_name: lead.style_name || lead.portfolio?.name || 'Unknown',
            organization_id: lead.organization_id,
            generated_design_url: designUrl,
            estimate_json: lead.estimate_json || {},
            attachments: lead.attachments || []
        };
    });

    return leads;
}

export async function updateLeadStatus(leadId: string, status: Lead['status']) {
    const { getActingUser } = await import('@/lib/auth-context');
    const { user, tenantId, supabase: actingSupabase } = await getActingUser();

    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await actingSupabase
        .from('leads')
        .update({ status })
        .eq('id', leadId)
        .eq('organization_id', tenantId);

    if (error) {
        console.error('Update Status Error:', error);
        return { success: false, error: 'Database error' };
    }

    return { success: true };
}

export async function markLeadOpened(leadId: string) {
    const { getActingUser } = await import('@/lib/auth-context');
    const { user, tenantId, supabase: actingSupabase } = await getActingUser();

    if (!user) return { success: false, error: 'Unauthorized' };

    // Only update to 'Pending' if currently 'New'
    const { error } = await actingSupabase
        .from('leads')
        .update({ status: 'Pending' })
        .eq('id', leadId)
        .eq('organization_id', tenantId)
        .eq('status', 'New');

    if (error) {
        // Ignore error if row doesn't match filter (already opened)
        console.error('Mark Opened Error:', error);
        return { success: false };
    }

    return { success: true };
}

export async function deleteLead(leadId: string) {
    const { getActingUser } = await import('@/lib/auth-context');
    const { user, tenantId, supabase: actingSupabase } = await getActingUser();

    if (!user) return { success: false, error: 'Unauthorized' };

    // SECURITY: Strictly enforce organization_id match
    const { error } = await actingSupabase
        .from('leads')
        .delete()
        .eq('id', leadId)
        .eq('organization_id', tenantId);

    if (error) {
        console.error('Delete Lead Error:', error);
        return { success: false, error: 'Failed to delete quote' };
    }

    return { success: true };
}

// --- Stats Actions ---
export async function getTenantStatsLegacy() {
    const { getActingUser } = await import('@/lib/auth-context');
    const { user, tenantId, supabase: actingSupabase } = await getActingUser();
    if (!user) return { totalGenerations: 0, topStyle: 'None' };

    const { data, error } = await actingSupabase
        .from('leads')
        .select('style_name')
        .eq('organization_id', tenantId);

    if (error || !data) return { totalGenerations: 0, topStyle: 'None' };

    const totalGenerations = data.length;

    // Calculate Top Style
    const styleCounts: Record<string, number> = {};
    data.forEach((l: any) => {
        const s = l.style_name || 'Unknown';
        styleCounts[s] = (styleCounts[s] || 0) + 1;
    });

    const topStyle = Object.entries(styleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

    return { totalGenerations, topStyle };
}
