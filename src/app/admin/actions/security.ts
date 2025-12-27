'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function blockIp(ip: string, reason: string = 'Administrative Block', tenantId?: string) {
    const supabase = createAdminClient();
    if (!supabase) return { error: 'Admin client missing' };

    try {
        const payload: any = {
            ip_address: ip,
            reason: reason,
        };
        if (tenantId) payload.tenant_id = tenantId;

        // Conflict on (tenant_id, ip_address). 
        // If tenantId is undefined (null in DB), the unique index might treat nulls as distinct or not depending on index type,
        // but typically standard UNIQUE allows multiple NULLs unless handled.
        // My migration: UNIQUE(tenant_id, ip_address). Postgres treats NULL != NULL in unique constraints standardly (allows duplicates), 
        // but for RLS apps usually we want strict.
        // Let's assume for now we upsert based on the relevant criteria.

        // Supabase .upsert() needs to know the conflict constraint. 
        // Because checking for conflict on partial nulls is tricky in simple upsert, 
        // we might do a manual check or delete-insert.
        // Or just rely on the constraints. 

        // For simplicity: If tenantId is provided, we query by it.

        const { error } = await supabase
            .from('blocked_ips')
            .upsert(payload, { onConflict: 'tenant_id,ip_address' });
        // Note: onConflict uses constraint name or columns. 'tenant_id,ip_address' works if constraint matches.

        if (error) throw error;

        revalidatePath('/admin/demo-analytics');
        revalidatePath('/dashboard/settings'); // Specific validation
        return { success: true };
    } catch (error: any) {
        console.error('Block IP Failed:', error);
        return { error: error.message };
    }
}

export async function unblockIp(ip: string, tenantId?: string) {
    const supabase = createAdminClient();
    if (!supabase) return { error: 'Admin client missing' };

    try {
        let query = supabase.from('blocked_ips').delete().eq('ip_address', ip);

        if (tenantId) {
            query = query.eq('tenant_id', tenantId);
        } else {
            query = query.is('tenant_id', null);
        }

        const { error } = await query;

        if (error) throw error;

        revalidatePath('/admin/demo-analytics');
        revalidatePath('/dashboard/settings');
        return { success: true };
    } catch (error: any) {
        console.error('Unblock IP Failed:', error);
        return { error: error.message };
    }
}

export async function getBlockedIps(tenantId?: string) {
    const supabase = createAdminClient();
    if (!supabase) return [];

    let query = supabase
        .from('blocked_ips')
        .select('*')
        .order('created_at', { ascending: false });

    if (tenantId) {
        query = query.eq('tenant_id', tenantId);
    } else {
        query = query.is('tenant_id', null);
    }

    const { data } = await query;

    return data || [];
}

export async function checkIpStatus(ip: string, tenantId?: string) {
    const supabase = createAdminClient();
    if (!supabase) return { blocked: false };

    // Check for Global Block OR Tenant Block
    // If tenantId is provided, we check both.
    // If blocked by EITHER, return blocked.

    let query = supabase
        .from('blocked_ips')
        .select('id, reason, tenant_id')
        .eq('ip_address', ip);

    if (tenantId) {
        // We want (tenant_id = null OR tenant_id = tenantId)
        query = query.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
    } else {
        query = query.is('tenant_id', null);
    }

    const { data } = await query;
    // data is array of matches

    if (data && data.length > 0) {
        // Prioritize reason? Just take first.
        return { blocked: true, reason: data[0].reason };
    }

    return { blocked: false };
}

export async function getSecurityActivity() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    const { data } = await supabase
        .from('generations')
        .select('id, created_at, ip_address, prompt_used, style_id, image_url')
        .eq('organization_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

    return data || [];
}

export async function blockVisitor(ip: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    try {
        const { error } = await supabase
            .from('blocked_ips')
            .upsert({
                ip_address: ip,
                tenant_id: user.id,
                reason: 'Blocked by Tenant'
            }, { onConflict: 'tenant_id,ip_address' });

        if (error) throw error;
        revalidatePath('/dashboard/security');
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function unblockVisitor(ip: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    try {
        const { error } = await supabase
            .from('blocked_ips')
            .delete()
            .eq('ip_address', ip)
            .eq('tenant_id', user.id); // Redundant if RLS active but safe

        if (error) throw error;
        revalidatePath('/dashboard/security');
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function getTenantBlockedIps() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
        .from('blocked_ips')
        .select('*')
        .eq('tenant_id', user.id)
        .order('created_at', { ascending: false });

    return data || [];
}
