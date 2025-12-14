'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateDesignWithNanoBanana } from '@/lib/vertex';
import { InputSanitizer } from '@/components/security/InputSanitizer';

export interface GlobalStats {
    totalLeads: number;
    activeTenants: number;
    conversionRate: number; // Percentage 0-100
    totalGenerations: number;
    estimatedApiCost: number;
    uniqueIps: number;
    topStyles: { name: string, count: number }[];
}

export async function getGlobalStats(): Promise<GlobalStats> {
    const supabase = createAdminClient();

    // Fallback if no admin key (local dev without service key)
    if (!supabase) {
        console.warn('Admin client missing in getGlobalStats. Returning mock data.');
        return { totalLeads: 0, activeTenants: 0, conversionRate: 0, totalGenerations: 0, estimatedApiCost: 0, uniqueIps: 0, topStyles: [] };
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

    const genCountVal = genCount || 0;
    // Estimate: $0.04 per image (input + output)
    const estimatedCost = parseFloat((genCountVal * 0.04).toFixed(2));

    // 5. Stylistic & IP Analytics
    const { data: genData } = await supabase
        .from('generations')
        .select('style_id, ip_address');

    const styleCounts: Record<string, number> = {};
    const uniqueIps = new Set<string>();

    genData?.forEach(g => {
        if (g.style_id) styleCounts[g.style_id] = (styleCounts[g.style_id] || 0) + 1;
        if (g.ip_address) uniqueIps.add(g.ip_address);
    });

    const topStyles = Object.entries(styleCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    return {
        totalLeads: totalLeads || 0,
        activeTenants: activeTenants,
        conversionRate: parseFloat(rate.toFixed(1)),
        totalGenerations: genCountVal,
        estimatedApiCost: estimatedCost,
        uniqueIps: uniqueIps.size,
        topStyles
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
    let supabase = createAdminClient();

    // Graceful fallback if no admin client (e.g. Supabase Service Key missing locally)
    if (!supabase) {
        console.warn('getSystemPrompt: Admin client missing. Falling back to standard client.');
        supabase = await createClient();
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

export async function getActiveSystemPrompt() {
    let supabase = createAdminClient();
    if (!supabase) {
        // Fallback for local dev without service key
        supabase = await createClient();
    }

    const { data, error } = await supabase
        .from('system_prompts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false }) // Fallback tiebreaker
        .limit(1)
        .single();

    if (error) {
        // Fallback to main if no active one found (shouldn't happen due to default)
        return getSystemPrompt('gemini-handrail-main');
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
    is_active?: boolean;
}

export async function createSystemPrompt(key: string, instruction: string, template: string) {
    const supabase = createAdminClient();
    if (!supabase) return { error: 'Admin client missing' };

    // Check if key exists
    const { data: existing } = await supabase
        .from('system_prompts')
        .select('key')
        .eq('key', key)
        .single();

    if (existing) return { error: 'Prompt with this key already exists.' };

    const { error } = await supabase
        .from('system_prompts')
        .insert({
            key,
            system_instruction: instruction,
            user_template: template,
            is_active: false // Default to inactive
        });

    if (error) return { error: error.message };
    return { success: true };
}

export async function setActivePrompt(key: string) {
    const supabase = createAdminClient();
    if (!supabase) return { error: 'Admin client missing' };

    // Transaction-like update: Set all to false, then target to true.
    // Supabase doesn't support transactions via client easily without RPC, 
    // so we'll do it sequentially. Race condition possible but low risk for admin tool.

    const { error: resetError } = await supabase
        .from('system_prompts')
        .update({ is_active: false })
        .neq('key', key); // Optimization: Don't disable the one we're enabling if it was already (though we overwrite it next)

    if (resetError) return { error: 'Failed to reset prompts: ' + resetError.message };

    const { error: setError } = await supabase
        .from('system_prompts')
        .update({ is_active: true })
        .eq('key', key);

    if (setError) return { error: 'Failed to activate prompt: ' + setError.message };

    return { success: true };
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
    let supabase = createAdminClient();
    if (!supabase) {
        console.warn('Admin Client unavailable (missing service key?), falling back to standard client.');
        supabase = await createClient();
    }

    const { data, error } = await supabase
        .from('system_prompts')
        .select('*')
        .order('is_active', { ascending: false }) // Active first
        .order('updated_at', { ascending: false }); // Newest next

    if (error) {
        console.error('Failed to fetch all prompts:', error);
        return [];
    }
    return data;
}

export async function diagnoseConnection() {
    const report: string[] = [];

    // 1. Env Var Check
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    report.push(`Service Key Present: ${!!key ? 'YES (Length: ' + key.length + ')' : 'NO'}`);

    // 2. Auth Check (Standard Client)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    report.push(`Auth User: ${user ? 'YES (' + user.email + ')' : 'NO'} - ${authError ? authError.message : 'OK'}`);

    // 3. Admin Client Check
    const adminClient = createAdminClient();
    report.push(`Admin Client Created: ${!!adminClient ? 'YES' : 'NO'}`);

    if (adminClient) {
        const { count, error } = await adminClient.from('system_prompts').select('*', { count: 'exact', head: true });
        report.push(`Admin Query: ${error ? 'ERROR ' + error.message : 'SUCCESS (Count: ' + count + ')'}`);
    } else {
        // Fallback Query Check
        const { count, error } = await supabase.from('system_prompts').select('*', { count: 'exact', head: true });
        report.push(`Fallback Query: ${error ? 'ERROR ' + error.message : 'SUCCESS (Count: ' + count + ')'}`);
    }

    return report.join('\n');
}

export async function testDesignGeneration(formData: FormData) {
    console.log('[DEBUG] testDesignGeneration called via Admin Dashboard');

    // 1. Extract Inputs
    const imageFile = formData.get('image') as File;
    const styleFile = formData.get('style_image') as File;
    const systemInstruction = formData.get('system_instruction') as string;
    const userTemplate = formData.get('user_template') as string;

    if (!imageFile || !styleFile) {
        return { error: 'Both Source Image and Style Image are required for testing.' };
    }

    try {
        // 2. Prepare Base64
        const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
        const base64Image = imageBuffer.toString('base64');

        const styleBuffer = Buffer.from(await styleFile.arrayBuffer());
        const base64Style = styleBuffer.toString('base64');
        const styleInput = { base64StyleImage: base64Style };

        // 3. Prepare Config
        const promptConfig = {
            systemInstruction: systemInstruction,
            userTemplate: userTemplate
        };

        // 4. Call Vertex
        const result = await generateDesignWithNanoBanana(base64Image, styleInput, promptConfig);

        if (result.success && result.image) {
            return { success: true, image: result.image };
        } else {
            return { error: result.error || 'Unknown Generation Error' };
        }

    } catch (error: any) {
        console.error('Test Generation Failed:', error);
        return { error: error.message };
    }
}
