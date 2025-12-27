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
    const quotes = leads.filter(l => l.status !== 'Download');
    const downloads = leads.filter(l => l.status === 'Download');

    // Metrics
    const totalGenerations = generations.length;
    const totalQuotes = quotes.length;
    const totalDownloads = downloads.length;
    const salesCount = quotes.filter(l => l.status === 'Sold').length;
    const conversionRate = totalQuotes > 0 ? ((salesCount / totalQuotes) * 100).toFixed(1) : '0.0';

    // Top Style
    const styleCounts: Record<string, number> = {};
    generations.forEach(g => {
        if (g.style_id) styleCounts[g.style_id] = (styleCounts[g.style_id] || 0) + 1;
    });
    const topStyleId = Object.entries(styleCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    let topStyleName = 'None';

    // Fetch style name if exists (same logic as before)
    if (topStyleId) {
        const { data: style } = await supabase.from('portfolio').select('name').eq('id', topStyleId).single();
        if (style) topStyleName = style.name;
    }

    // Chart Data (Group by Day)
    // Map dates to objects
    const chartMap: Record<string, { date: string, quotes: number, sales: number, generations: number, downloads: number }> = {};

    // Helper
    const getKey = (d: string) => d.split('T')[0]; // YYYY-MM-DD

    generations.forEach(g => {
        const k = getKey(g.created_at);
        if (!chartMap[k]) chartMap[k] = { date: k, quotes: 0, sales: 0, generations: 0, downloads: 0 };
        chartMap[k].generations++;
    });

    // Process Quotes
    quotes.forEach(l => {
        const k = getKey(l.created_at);
        if (!chartMap[k]) chartMap[k] = { date: k, quotes: 0, sales: 0, generations: 0, downloads: 0 };
        chartMap[k].quotes++;
        if (l.status === 'Sold') chartMap[k].sales++;
    });

    // Process Downloads
    downloads.forEach(l => {
        const k = getKey(l.created_at);
        if (!chartMap[k]) chartMap[k] = { date: k, quotes: 0, sales: 0, generations: 0, downloads: 0 };
        chartMap[k].downloads++;
    });

    const chartData = Object.values(chartMap).sort((a, b) => a.date.localeCompare(b.date));

    return {
        totalGenerations,
        totalQuotes,
        totalDownloads,
        salesCount,
        conversionRate,
        topStyle: topStyleName,
        chartData
    };
}

