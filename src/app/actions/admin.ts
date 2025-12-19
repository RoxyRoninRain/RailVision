'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function getAdminStats() {
    const supabaseUser = await createClient();
    const { data: { user } } = await supabaseUser.auth.getUser();

    // Switch to Admin Client for Data Fetching to bypass RLS
    const supabase = createAdminClient();
    if (!supabase) return [];

    // Security Check
    // In real app, check a specific role or table. For now, check email.
    if (!user || !['admin@railify.com', 'me@railify.com'].includes(user.email || '')) {
        // Fallback or empty if not admin
        // But we might want to return empty to avoid leaking info
        // Check constraints: "Ensure /admin is absolutely unreachable by normal users"
        // This action should probably throw or return empty.
        console.warn('Unauthorized Access to Admin Stats');
        return [];
    }

    // --- AGGREGATE STATS ---
    // Ideally use RPC or count queries. For now, fetching leads/generations might be heavy if scaled.
    // 1. Get All Profiles (Tenants)
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, shop_name, email');

    // 2. Get Lead Counts per Org
    const { data: leads } = await supabase
        .from('leads')
        .select('organization_id');

    const leadCounts: Record<string, number> = {};
    leads?.forEach(l => {
        if (l.organization_id) leadCounts[l.organization_id] = (leadCounts[l.organization_id] || 0) + 1;
    });

    // 3. Get Generation Counts per Org
    const { data: generations } = await supabase
        .from('generations')
        .select('organization_id');

    const genCounts: Record<string, number> = {};
    generations?.forEach(g => {
        if (g.organization_id) genCounts[g.organization_id] = (genCounts[g.organization_id] || 0) + 1;
    });

    // 4. Combine
    const allOrgIds = new Set([
        ...(profiles?.map(p => p.id) || []),
        ...Object.keys(leadCounts),
        ...Object.keys(genCounts)
    ]);

    // 8. Map and Filter
    const stats = Array.from(allOrgIds).map(orgId => {
        const profile = profiles?.find(p => p.id === orgId);
        return {
            organization_id: orgId,
            shop_name: profile?.shop_name || 'Unknown Shop', // New Field
            email: profile?.email || '', // New Field
            count: leadCounts[orgId] || 0,
            generation_count: genCounts[orgId] || 0
        };
    });

    // Filter out Admin Account (User Request)
    return stats.filter(s => s.email !== 'admin@railify.com');
}

export async function testResendConnectivity(apiKey: string, fromEmail: string, toEmail: string) {
    try {
        // Dynamic import to prevent build errors if 'resend' isn't used elsewhere or causes edge issues
        const { Resend } = await import('resend');
        const resend = new Resend(apiKey);

        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: toEmail,
            subject: 'Test Connectivity from RailVision Admin',
            html: '<p>If you see this, the API Key works!</p>'
        });

        if (error) {
            return { success: false, error: error };
        }
        return { success: true, data };
    } catch (err: any) {
        console.error('Test Resend Connectivity Error:', err);
        return { success: false, error: err.message || 'Unknown error' };
    }
}
