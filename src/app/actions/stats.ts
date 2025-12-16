'use server';

import { createClient } from '@/lib/supabase/server';

export async function getTenantStats() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // 1. Total Generations
    const { count: totalGenerations } = await supabase
        .from('generations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', user.id);

    // 2. Top Style
    const { data: styleData } = await supabase
        .from('generations')
        .select('style_id')
        .eq('organization_id', user.id);

    const styleCounts: Record<string, number> = {};
    styleData?.forEach((g: any) => {
        if (g.style_id) styleCounts[g.style_id] = (styleCounts[g.style_id] || 0) + 1;
    });

    const topStyle = Object.entries(styleCounts)
        .sort((a, b) => b[1] - a[1])[0];

    return {
        totalGenerations: totalGenerations || 0,
        topStyle: topStyle ? topStyle[0] : 'None'
    };
}
