'use server';

import { createClient } from '@/lib/supabase/server';
import { startOfDay, subDays, subMonths, subYears, startOfYear, startOfMonth } from 'date-fns';

export async function getDeepStats(range: '7d' | '30d' | 'mtd' | 'ytd' | 'all' = '30d') {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // 1. Calculate Date Range
    const now = new Date();
    let startDate: Date;

    switch (range) {
        case '7d': startDate = subDays(now, 7); break;
        case '30d': startDate = subDays(now, 30); break;
        case 'mtd': startDate = startOfMonth(now); break;
        case 'ytd': startDate = startOfYear(now); break;
        case 'all': startDate = new Date(0); break; // Epoch
        default: startDate = subDays(now, 30);
    }

    const isoStart = startDate.toISOString();

    // 2. Parallel Queries
    // A. Generations
    const generationsPromise = supabase
        .from('generations')
        .select('created_at, style_id')
        .eq('organization_id', user.id)
        .gte('created_at', isoStart);

    // B. Leads
    const leadsPromise = supabase
        .from('leads')
        .select('created_at, status')
        .eq('organization_id', user.id)
        .gte('created_at', isoStart);

    // C. All time stats (for verification/cards that might need all time)
    // Actually, user asked to filter everything by the selected range, 
    // BUT usually "Total Generations" on a stats page might mean ALL TIME unless specified.
    // However, "Ability to filter by..." implies the cards should update.
    // Let's stick to the filtered range for the main view.

    const [genRes, leadsRes] = await Promise.all([generationsPromise, leadsPromise]);

    if (genRes.error || leadsRes.error) {
        console.error("Stats Error", genRes.error, leadsRes.error);
        return null;
    }

    const generations = genRes.data || [];
    const leads = leadsRes.data || [];

    // 3. Aggregate Data

    // Metrics
    const totalGenerations = generations.length;
    const totalQuotes = leads.length;
    const salesCount = leads.filter(l => l.status === 'Sold').length;
    const conversionRate = totalQuotes > 0 ? ((salesCount / totalQuotes) * 100).toFixed(1) : '0.0';

    // Top Style
    const styleCounts: Record<string, number> = {};
    generations.forEach(g => {
        if (g.style_id) styleCounts[g.style_id] = (styleCounts[g.style_id] || 0) + 1;
    });
    const topStyleId = Object.entries(styleCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    let topStyleName = 'None';

    // Fetch style name if exists
    if (topStyleId) {
        // We could optimize this by joining in the first query if we knew we needed names for all
        // But for just one, a quick lookup or just using ID if cache map not avail is fine.
        // Actually, let's just return the ID formatted or try to fetch it if we want perfection.
        // For speed, let's assume the ID is descriptive or we'll fetch it in UI? 
        // No, UI leads has it joined. 
        // Let's do a quick fetch of the single Portfolio item.
        const { data: style } = await supabase.from('portfolio').select('name').eq('id', topStyleId).single();
        if (style) topStyleName = style.name;
    }

    // Chart Data (Group by Day)
    // Map dates to objects
    const chartMap: Record<string, { date: string, quotes: number, sales: number, generations: number }> = {};

    // Helper
    const getKey = (d: string) => d.split('T')[0]; // YYYY-MM-DD

    generations.forEach(g => {
        const k = getKey(g.created_at);
        if (!chartMap[k]) chartMap[k] = { date: k, quotes: 0, sales: 0, generations: 0 };
        chartMap[k].generations++;
    });

    leads.forEach(l => {
        const k = getKey(l.created_at);
        if (!chartMap[k]) chartMap[k] = { date: k, quotes: 0, sales: 0, generations: 0 };
        chartMap[k].quotes++;
        if (l.status === 'Sold') chartMap[k].sales++;
    });

    // Fill in empty days? allow recharts to handle or strict series.
    // For "All time" filling empty days is too much.
    // For 7d/30d it's nice.
    // Let's just return the sparse data sorted by date.
    const chartData = Object.values(chartMap).sort((a, b) => a.date.localeCompare(b.date));

    return {
        totalGenerations,
        totalQuotes,
        salesCount,
        conversionRate,
        topStyle: topStyleName,
        chartData
    };
}

