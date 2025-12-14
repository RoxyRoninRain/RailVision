'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface GlobalStats {
    totalLeads: number;
    activeTenants: number;
    conversionRate: number; // Percentage 0-100
    totalGenerations: number;
}

export async function getGlobalStats(): Promise<GlobalStats> {
    const supabase = createAdminClient();

    // Fallback if no admin key (local dev without service key)
    if (!supabase) {
        console.warn('Admin client missing in getGlobalStats. Returning mock data.');
        return { totalLeads: 0, activeTenants: 0, conversionRate: 0, totalGenerations: 0 };
    }

    // 1. Total Leads
    const { count: totalLeads, error: leadsError } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true });

    if (leadsError) console.error('Error fetching total leads:', leadsError);

    // 2. Active Tenants (Tenants with leads created in the last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Distinct organization_ids from leads in last 30 days
    const { data: activeOrgData, error: activeError } = await supabase
        .from('leads')
        .select('organization_id')
        .gte('created_at', thirtyDaysAgo.toISOString());

    let activeTenants = 0;
    if (activeOrgData) {
        const uniqueOrgs = new Set(activeOrgData.map(l => l.organization_id).filter(Boolean));
        activeTenants = uniqueOrgs.size;
    }

    // 3. Conversion Rate (Closed / Total)
    const { count: closedLeads, error: closedError } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Closed');

    const rate = (totalLeads && totalLeads > 0 && closedLeads)
        ? ((closedLeads / totalLeads) * 100)
        : 0;

    // 4. Total Generations
    const { count: genCount, error: genError } = await supabase
        .from('generations')
        .select('*', { count: 'exact', head: true });

    return {
        totalLeads: totalLeads || 0,
        activeTenants: activeTenants,
        conversionRate: parseFloat(rate.toFixed(1)),
        totalGenerations: genCount || 0
    };
}

export async function getTenantDetails(tenantId: string) {
    const supabase = createAdminClient();
    if (!supabase) return null;

    // Fetch Profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', tenantId)
        .single();

    // Fetch Recent Leads
    const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);

    return {
        profile,
        leads
    };
}

// RESTORED: System Prompt Fetcher used by src/app/actions.ts
export async function getSystemPrompt(key: string) {
    const supabase = createAdminClient();

    // Graceful fallback if no admin client (e.g. Supabase Service Key missing locally)
    if (!supabase) {
        console.warn('getSystemPrompt: Admin client missing. Returning null.');
        return null;
    }

    const { data, error } = await supabase
        .from('system_prompts')
        .select('*')
        .eq('key', key)
        .single();

    if (error) {
        // It's common to not have the prompt in DB yet, so just warn
        console.warn(`Failed to fetch system prompt (${key}):`, error.message);
        return null;
    }

    return data;
}

export interface SystemPrompt {
    id?: string;
    key: string;
    system_instruction: string;
    user_template: string;
    description?: string;
    created_at?: string;
}

export async function updateSystemPrompt(key: string, updates: Partial<SystemPrompt>) {
    const supabase = createAdminClient();
    if (!supabase) return { error: 'Admin client missing (SUPABASE_SERVICE_ROLE_KEY not set)' };

    // Update using key as identifier
    const { error } = await supabase
        .from('system_prompts')
        .update(updates)
        .eq('key', key);

    if (error) return { error: error.message };
    return { success: true };
}

export async function getAllSystemPrompts() {
    const supabase = createAdminClient();
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('system_prompts')
        .select('*')
        .order('key', { ascending: true });

    if (error) {
        console.error('Failed to fetch all prompts:', error);
        return [];
    }
    return data;
}
