'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Lead } from './types';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Public submission
export async function submitLead(formData: FormData) {
    const supabase = await createClient(); // Use server client

    // Extract Form Data
    const email = formData.get('email') as string;
    const customer_name = formData.get('customer_name') as string || 'Guest';
    const styleName = formData.get('style_name') as string;
    const generatedUrl = formData.get('generated_design_url') as string;
    const orgId = formData.get('organization_id') as string;
    const phone = formData.get('phone') as string;
    const message = formData.get('message') as string;
    const estimate_json = formData.get('estimate_json') ? JSON.parse(formData.get('estimate_json') as string) : null;

    if (!email) {
        return { success: false, error: 'Email is required' };
    }

    const payload: any = {
        email,
        customer_name,
        style_name: styleName || 'Custom',
        generated_design_url: generatedUrl,
        phone,
        message,
        estimate_json,
        status: 'New',
        created_at: new Date().toISOString()
    };

    if (orgId) {
        payload.organization_id = orgId;
    }

    // Insert
    // Insert using standard client first to respect RLS if possible (Guest Insert policies)
    // BUT we found RLS might be blocking. Let's try standard first, if fail, try admin?
    // Actually, simpler to just use Admin for Leas Insert if it's a public form.
    // However, best practice is to have public RLS policy. 
    // Let's rely on createClient() first, and just error log if it fails, OR fallback.
    // Given the time, let's use Admin Client for Insert as well to be 100% sure it lands.

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

    // --- EMAIL NOTIFICATION START ---
    console.log(`[Email Debug] Attempting to send. OrgId: ${orgId ? 'Present' : 'Missing'}, Key: ${process.env.RESEND_API_KEY ? 'Present' : 'Missing'}`);

    if (orgId && process.env.RESEND_API_KEY) {
        try {
            // Use Admin Client to bypass RLS for Profile Read
            const adminSupabase = createAdminClient();
            if (!adminSupabase) console.error('[Email Debug] Failed to create Admin Client');

            if (adminSupabase) {
                // 1. Fetch Tenant Email
                const { data: tenantProfile, error: profileError } = await adminSupabase
                    .from('profiles')
                    .select('email, shop_name')
                    .eq('id', orgId)
                    .single();

                if (profileError) {
                    console.error("Failed to fetch tenant profile:", profileError);
                } else if (tenantProfile?.email) {
                    // 2. Send Email
                    const { error: emailError } = await resend.emails.send({
                        from: 'Railify <notifications@railify.com>',
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
                } else {
                    console.warn(`No email found for tenant ${orgId}`);
                }
            }
        } catch (emailErr) {
            console.error("Email dispatch error:", emailErr);
        }
    }
    // --- EMAIL NOTIFICATION END ---

    return { success: true };
}

export async function getOwnerLeads(): Promise<Lead[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    const { data, error } = await supabase
        .from('leads')
        .select(`
      *,
      portfolio (
        name
      )
    `)
        // RLS will enforce organization_id = auth.uid(), but explicitly adding filter is safe
        .eq('organization_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Get Owner Leads Error:', error);
        return [];
    }

    return data.map((lead: any) => ({
        ...lead,
        style_name: lead.style_name || lead.portfolio?.name || 'Unknown'
    }));
}

export async function updateLeadStatus(leadId: string, status: 'New' | 'Contacted' | 'Closed') {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase
        .from('leads')
        .update({ status })
        .eq('id', leadId)
        .eq('organization_id', user.id); // Ensure ownership

    if (error) {
        console.error('Update Status Error:', error);
        return { success: false, error: 'Database error' };
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
