'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function blockIp(ip: string, reason: string = 'Administrative Block') {
    const supabase = createAdminClient();
    if (!supabase) return { error: 'Admin client missing' };

    try {
        const { error } = await supabase
            .from('blocked_ips')
            .upsert({
                ip_address: ip,
                reason: reason
            }, { onConflict: 'ip_address' });

        if (error) throw error;

        revalidatePath('/admin/demo-analytics');
        return { success: true };
    } catch (error: any) {
        console.error('Block IP Failed:', error);
        return { error: error.message };
    }
}

export async function unblockIp(ip: string) {
    const supabase = createAdminClient();
    if (!supabase) return { error: 'Admin client missing' };

    try {
        const { error } = await supabase
            .from('blocked_ips')
            .delete()
            .eq('ip_address', ip);

        if (error) throw error;

        revalidatePath('/admin/demo-analytics');
        return { success: true };
    } catch (error: any) {
        console.error('Unblock IP Failed:', error);
        return { error: error.message };
    }
}

export async function getBlockedIps() {
    const supabase = createAdminClient();
    if (!supabase) return [];

    const { data } = await supabase
        .from('blocked_ips')
        .select('*')
        .order('created_at', { ascending: false });

    return data || [];
}

export async function checkIpStatus(ip: string) {
    const supabase = createAdminClient();
    if (!supabase) return { blocked: false };

    const { data } = await supabase
        .from('blocked_ips')
        .select('id, reason')
        .eq('ip_address', ip)
        .single();

    return { blocked: !!data, reason: data?.reason };
}
