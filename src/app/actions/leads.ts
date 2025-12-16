'use server';

import { createClient } from '@/lib/supabase/server';
import { Lead } from './types';

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
    const { error } = await supabase
        .from('leads')
        .insert([payload]);

    if (error) {
        console.error('Supabase Error:', error);
        return { success: false, error: 'Database error' };
    }

    // Stub for Email Notification
    console.log(`[Notification] New Quote Request for Tenant ${orgId || 'Generic'}: ${customer_name} (${email})`);

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
        style_name: lead.portfolio?.name || 'Unknown'
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
