'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Lead } from './types';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Public submission
export async function trackDownload(formData: FormData) {
    const supabase = await createClient();
    const orgId = formData.get('organization_id') as string;
    const styleName = formData.get('style_name') as string;
    const generatedUrl = formData.get('generated_design_url') as string;

    const payload = {
        organization_id: orgId,
        style_name: styleName || 'Unknown',
        generated_design_url: generatedUrl,
        customer_name: 'Anonymous Download',
        email: 'anonymous@download', // Placeholder to satisfy DB constraint if any, and distinguish in UI
        status: 'New', // Default status
        created_at: new Date().toISOString()
    };

    const { error } = await supabase
        .from('leads')
        .insert([payload]);

    if (error) {
        console.error('Track Download Error:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

export async function submitLead(formData: FormData) {
    const supabase = await createClient(); // Use server client

    // Extract Form Data
    const email = formData.get('email') as string;
    const customer_name = formData.get('customer_name') as string || 'Guest';
    const styleName = formData.get('style_name') as string;
    let generatedUrl = formData.get('generated_design_url') as string;
    const orgId = formData.get('organization_id') as string;
    const phone = formData.get('phone') as string;
    const message = formData.get('message') as string;
    const estimate_json = formData.get('estimate_json') ? JSON.parse(formData.get('estimate_json') as string) : null;

    // File Uploads
    const files = formData.getAll('files') as File[];
    const attachmentUrls: string[] = [];
    const uploadErrors: string[] = [];

    // --- HANDLE BASE64 GENERATED IMAGE START ---
    // If the generated URL is a Base64 string (from Nano Banana), upload it to Storage
    if (generatedUrl && generatedUrl.startsWith('data:image')) {
        try {
            console.log('[Upload Debug] Found Base64 generated image. Uploading to Storage...');
            const matches = generatedUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);

            if (matches && matches.length === 3) {
                const ext = matches[1];
                const base64Data = matches[2];
                const buffer = Buffer.from(base64Data, 'base64');
                const fileName = `generated/${orgId || 'public'}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

                const { error: uploadError } = await supabase.storage
                    .from('quote-uploads')
                    .upload(fileName, buffer, {
                        contentType: `image/${ext}`
                    });

                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage
                        .from('quote-uploads')
                        .getPublicUrl(fileName);

                    console.log(`[Upload Debug] Generated image uploaded to: ${publicUrl}`);
                    // OVERWRITE the Base64 string with the clean URL
                    generatedUrl = publicUrl;
                    // Note: We need to re-assign the variable, but it's const in the destructuring (actually it's declared with const above)
                    // Wait, generatedUrl was declared as check previously. Let's fix the variable declaration.
                } else {
                    console.error('[Upload Debug] Failed to upload generated image:', uploadError);
                    uploadErrors.push('Failed to save generated design.');
                }
            }
        } catch (e) {
            console.error('[Upload Debug] Exception uploading generated image:', e);
        }
    }
    // --- HANDLE BASE64 GENERATED IMAGE END ---

    if (!email) {
        return { success: false, error: 'Email is required' };
    }

    // Moved uploadErrors to top

    // 1. Handle File Uploads
    if (files.length > 0) {
        console.log(`[Upload Debug] Received ${files.length} files`);
        for (const file of files) {
            console.log(`[Upload Debug] Processing ${file.name}, size: ${file.size}`);

            // Basic validation
            if (file.size > 50 * 1024 * 1024) { // 50MB per file
                uploadErrors.push(`${file.name} too large`);
                continue;
            }

            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${orgId || 'public'}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('quote-uploads')
                .upload(filePath, file);

            if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage
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
    const adminSupabase = createAdminClient();
    const dbClient = adminSupabase || supabase;

    const { error } = await dbClient
        .from('leads')
        .insert([payload]);

    if (error) {
        console.error('Supabase Error:', error);
        return { success: false, error: 'Database error' };
    }

    // Stub for Email Notification
    console.log(`[Notification] New Quote Request for Tenant ${orgId || 'Generic'}: ${customer_name} (${email})`);

    // --- EMAIL NOTIFICATIONS START ---
    console.log(`[Email Debug] Attempting to send. OrgId: ${orgId ? 'Present' : 'Missing'}, Key: ${process.env.RESEND_API_KEY ? 'Present' : 'Missing'}`);

    if (orgId && process.env.RESEND_API_KEY) {
        try {
            // Use Admin Client to bypass RLS for Profile Read
            const adminSupabase = createAdminClient();
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

                    // Email 1: To Tenant (New Lead Alert)
                    const { error: emailError } = await resend.emails.send({
                        from: 'Railify <notifications@railify.app>',
                        to: tenantProfile.email,
                        subject: `New Quote Request: ${customer_name}`,
                        html: `
                        <div style="font-family: sans-serif; color: #333;">
                            <h2>New Logic/Quote Request</h2>
                            <p><strong>Customer:</strong> ${customer_name}</p>
                            <p><strong>Email:</strong> ${email}</p>
                            <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
                            <p><strong>Style:</strong> ${styleName}</p>
                            <p><strong>Message:</strong><br/>${message ? message.replace(/\n/g, '<br/>') : 'No message'}</p>
                            
                            ${estimate_json ? `
                                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                    <h3>Estimate Details</h3>
                                    <pre style="margin: 0;">${JSON.stringify(estimate_json, null, 2)}</pre>
                                </div>
                            ` : ''}

                             ${generatedUrl ? `
                                <div style="margin-top: 20px;">
                                    <p><strong>Generated Design:</strong></p>
                                    <img src="${generatedUrl}" alt="Design" style="max-width: 300px; border-radius: 8px;" />
                                    <p><a href="${generatedUrl}">View Full Image</a></p>
                                </div>
                            ` : ''}

                            ${attachmentUrls.length > 0 ? `
                                <div style="margin-top: 20px; border-top: 1px solid #eee; pt-3;">
                                    <p><strong>Customer Uploads (${attachmentUrls.length}):</strong></p>
                                    <ul>
                                        ${attachmentUrls.map(url => `<li><a href="${url}">View Photo</a></li>`).join('')}
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
                        console.log(`[Email Debug] Success. Email sent to ${tenantProfile.email}`);
                    }

                    // Email 2: To Customer (Confirmation)
                    const confirmationBody = tenantProfile.confirmation_email_body ||
                        "Thank you for your request! We have received your details and will be reviewing your project shortly. Expect to hear from us within 1-2 business days with a formal quote.";

                    const { error: customerEmailError } = await resend.emails.send({
                        from: `${tenantProfile.shop_name || 'Railify'} <notifications@railify.app>`, // "Acme Metal <notifications@railify.app>"
                        to: email, // Customer email
                        replyTo: tenantProfile.email, // Replies go to Tenant
                        subject: `We received your request! - ${tenantProfile.shop_name || 'Railify'}`,
                        html: `
                        <div style="font-family: sans-serif; color: #333;">
                            <h2>Hello ${customer_name},</h2>
                            <p>${confirmationBody.replace(/\n/g, '<br/>')}</p>
                            <br/>
                            <p><strong>Your Project Summary:</strong></p>
                            <ul>
                                <li>Style: ${styleName}</li>
                                ${estimate_json && estimate_json.min ? `<li>Est. Price: $${estimate_json.min} - $${estimate_json.max}</li>` : ''}
                            </ul>
                            <br/>
                            <p>Best regards,</p>
                            <p><strong>${tenantProfile.shop_name || 'The Railify Team'}</strong></p>
                        </div>
                        `
                    });

                    if (customerEmailError) {
                        console.error("[Email Debug] Customer Confirmation Failed:", customerEmailError);
                    } else {
                        console.log(`[Email Debug] Confirmation sent to customer ${email}`);
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    console.log(`[DEBUG] getOwnerLeads: Fetching leads. Limit: ${limit}, Status: ${statusFilter}`);

    let query = supabase
        .from('leads')
        .select(`
          id, created_at, email, customer_name, status, organization_id, generated_design_url, estimate_json, attachments,
          portfolio ( name )
        `)
        .eq('organization_id', user.id)
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
            style_name: lead.portfolio?.name || 'Unknown',
            organization_id: lead.organization_id,
            generated_design_url: designUrl,
            estimate_json: lead.estimate_json || {},
            attachments: lead.attachments || []
        };
    });

    return leads;
}

export async function updateLeadStatus(leadId: string, status: Lead['status']) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase
        .from('leads')
        .update({ status })
        .eq('id', leadId)
        .eq('organization_id', user.id);

    if (error) {
        console.error('Update Status Error:', error);
        return { success: false, error: 'Database error' };
    }

    return { success: true };
}

export async function markLeadOpened(leadId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Unauthorized' };

    // Only update to 'Pending' if currently 'New'
    const { error } = await supabase
        .from('leads')
        .update({ status: 'Pending' })
        .eq('id', leadId)
        .eq('organization_id', user.id)
        .eq('status', 'New');

    if (error) {
        // Ignore error if row doesn't match filter (already opened)
        console.error('Mark Opened Error:', error);
        return { success: false };
    }

    return { success: true };
}

export async function deleteLead(leadId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Unauthorized' };

    // SECURITY: Strictly enforce organization_id match
    const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId)
        .eq('organization_id', user.id);

    if (error) {
        console.error('Delete Lead Error:', error);
        return { success: false, error: 'Failed to delete quote' };
    }

    return { success: true };
}

// --- Stats Actions ---
export async function getTenantStatsLegacy() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { totalGenerations: 0, topStyle: 'None' };

    const { data, error } = await supabase
        .from('leads')
        .select('style_name');

    if (error || !data) return { totalGenerations: 0, topStyle: 'None' };

    const totalGenerations = data.length;

    // Calculate Top Style
    const styleCounts: Record<string, number> = {};
    data.forEach(l => {
        const s = l.style_name || 'Unknown';
        styleCounts[s] = (styleCounts[s] || 0) + 1;
    });

    const topStyle = Object.entries(styleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

    return { totalGenerations, topStyle };
}
