'use server';


import { createClient } from '@/lib/supabase/server';
import { checkIsAdmin } from '@/lib/auth-utils';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateDesignWithNanoBanana } from '@/lib/vertex';
import { InputSanitizer } from '@/components/security/InputSanitizer';
import { PRICING_TIERS, DEFAULT_TIER, TierName } from '@/config/pricing';
import { format, startOfMonth, startOfYear } from 'date-fns';

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
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return { totalLeads: 0, activeTenants: 0, conversionRate: 0, totalGenerations: 0, estimatedApiCost: 0, uniqueIps: 0, topStyles: [] };

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

export interface TenantBillingInfo {
    tier: string;
    tierConfig: {
        name: string;
        price: number;
        allowance: number;
        overageRate: number;
        billingThreshold: number;
        onboardingFee: number;
        features: string[];
    };
    amountPaying: {
        basePrice: number;
        interval: string;
        overageRate: number;
        pendingOverageBalance: number;
        currentOverageCount: number;
        currentCycleEstimatedTotal: number;
    };
    totalSpent: number;
    nextPaymentDueDate: string | null;
    daysRemaining: number | null;
    isPastDue: boolean;
    pastDueAmount: number;
    subscriptionStatus: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    cancelAtPeriodEnd: boolean;
    hasStripeAccount: boolean;
    lastPaymentDate: string | null;
    paidInvoicesCount: number;
}

export interface TenantGenerationsInfo {
    counts: {
        day: number;
        month: number;
        year: number;
        total: number;
        adminTests: number;
    };
    modelCost: {
        day: number;
        month: number;
        year: number;
        total: number;
    };
    profitability: {
        revenue: number;
        cost: number;
        grossProfit: number;
        marginPercent: number;
    };
    dailyBreakdown: { date: string; label: string; count: number; cost: number }[];
    monthlyBreakdown: { month: string; label: string; count: number; cost: number }[];
    recent: {
        id: string;
        created_at: string;
        style_id: string;
        model_id: string;
        input_tokens: number;
        output_tokens: number;
        cost: number;
        isAdminTest: boolean;
    }[];
}

export interface TenantDetailsResult {
    profile: any;
    leads: any[];
    billing: TenantBillingInfo;
    generations: TenantGenerationsInfo;
}

function computeGenerationModelCost(gen: any): number {
    if (gen.cost_usd !== undefined && gen.cost_usd !== null) {
        return Number(gen.cost_usd);
    }
    const model = (gen.model_id || '').toLowerCase();
    const input = Number(gen.input_tokens) || 0;
    const output = Number(gen.output_tokens) || 0;

    if (model.includes('flash-image') || model.includes('flash')) {
        return (input / 1000000) * 0.15 + (output / 1000000) * 0.60 + 0.030;
    } else if (model.includes('gemini-3')) {
        return (input / 1000000) * 2.00 + (output / 1000000) * 12.00 + 0.134;
    } else if (model.includes('imagen')) {
        return 0.040;
    }
    return 0.030 + (input / 1000000) * 0.15 + (output / 1000000) * 0.60;
}

export async function getTenantDetails(tenantId: string): Promise<TenantDetailsResult | null> {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return null;

    const supabase = createAdminClient();
    if (!supabase) return null;

    // 1. Fetch Profile
    const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', tenantId)
        .single();

    if (profileErr || !profile) {
        console.error('Tenant profile not found:', tenantId, profileErr);
        return null;
    }

    // 2. Fetch Recent Leads
    const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);

    // 3. Fetch Generations & Compute Day, Month, Year & Admin Model Usage Costs
    const { data: rawGenerations } = await supabase
        .from('generations')
        .select('id, created_at, model_id, input_tokens, output_tokens, prompt_used, style_id, cost_usd')
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: false });

    const generationsList = rawGenerations || [];

    const now = new Date();
    const startOfDayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfMonthTs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYearTs = new Date(now.getFullYear(), 0, 1).getTime();

    let dayCount = 0;
    let monthCount = 0;
    let yearCount = 0;
    let totalCount = 0;
    let adminTestsCount = 0;

    let modelCostDay = 0;
    let modelCostMonth = 0;
    let modelCostYear = 0;
    let modelCostTotal = 0;

    const dailyMap: Record<string, { date: string; label: string; count: number; cost: number }> = {};
    const monthlyMap: Record<string, { month: string; label: string; count: number; cost: number }> = {};

    const recentGenerations: TenantGenerationsInfo['recent'] = [];

    for (let i = 0; i < generationsList.length; i++) {
        const gen = generationsList[i];
        const isAdminTest = !!(gen.prompt_used && gen.prompt_used.includes('[ADMIN_TEST]'));
        if (isAdminTest) {
            adminTestsCount++;
        }

        const genCost = computeGenerationModelCost(gen);
        const createdAt = new Date(gen.created_at);
        const genTs = createdAt.getTime();

        totalCount++;
        modelCostTotal += genCost;

        if (genTs >= startOfDayTs) {
            dayCount++;
            modelCostDay += genCost;
        }
        if (genTs >= startOfMonthTs) {
            monthCount++;
            modelCostMonth += genCost;
        }
        if (genTs >= startOfYearTs) {
            yearCount++;
            modelCostYear += genCost;
        }

        // Daily breakdown (bucket by yyyy-MM-dd)
        const dayKey = format(createdAt, 'yyyy-MM-dd');
        if (!dailyMap[dayKey]) {
            dailyMap[dayKey] = {
                date: dayKey,
                label: format(createdAt, 'MMM d, yyyy'),
                count: 0,
                cost: 0
            };
        }
        dailyMap[dayKey].count += 1;
        dailyMap[dayKey].cost += genCost;

        // Monthly breakdown (bucket by yyyy-MM)
        const monthKey = format(createdAt, 'yyyy-MM');
        if (!monthlyMap[monthKey]) {
            monthlyMap[monthKey] = {
                month: monthKey,
                label: format(createdAt, 'MMM yyyy'),
                count: 0,
                cost: 0
            };
        }
        monthlyMap[monthKey].count += 1;
        monthlyMap[monthKey].cost += genCost;

        // Keep top 20 recent
        if (recentGenerations.length < 20) {
            recentGenerations.push({
                id: gen.id,
                created_at: gen.created_at,
                style_id: gen.style_id || 'Default',
                model_id: gen.model_id || 'gemini-3.1-flash-image',
                input_tokens: gen.input_tokens || 0,
                output_tokens: gen.output_tokens || 0,
                cost: parseFloat(genCost.toFixed(4)),
                isAdminTest
            });
        }
    }

    const dailyBreakdown = Object.values(dailyMap)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30);

    const monthlyBreakdown = Object.values(monthlyMap)
        .sort((a, b) => b.month.localeCompare(a.month))
        .slice(0, 12);

    // 4. Fetch Stripe Customer, Subscription, Invoices & Charges
    let stripeSub: any = null;
    let paidInvoices: any[] = [];
    let openInvoices: any[] = [];
    let upcomingInvoice: any = null;
    let stripeCharges: any[] = [];

    if (process.env.STRIPE_SECRET_KEY && (profile.stripe_subscription_id || profile.stripe_customer_id)) {
        try {
            const { stripe } = await import('@/lib/stripe');

            if (profile.stripe_subscription_id) {
                try {
                    stripeSub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
                } catch (err: any) {
                    console.warn('Could not retrieve subscription by ID, attempting customer search:', err?.message);
                }
            }

            if (!stripeSub && profile.stripe_customer_id) {
                try {
                    const subList = await stripe.subscriptions.list({
                        customer: profile.stripe_customer_id,
                        status: 'all',
                        limit: 1
                    });
                    if (subList.data && subList.data.length > 0) {
                        stripeSub = subList.data[0];
                    }
                } catch (err: any) {
                    console.warn('Could not list customer subscriptions:', err?.message);
                }
            }

            if (profile.stripe_customer_id) {
                try {
                    const paidList = await stripe.invoices.list({
                        customer: profile.stripe_customer_id,
                        status: 'paid',
                        limit: 100
                    });
                    paidInvoices = paidList.data || [];
                } catch (err: any) {
                    console.warn('Could not list paid invoices:', err?.message);
                }

                try {
                    const openList = await stripe.invoices.list({
                        customer: profile.stripe_customer_id,
                        status: 'open',
                        limit: 20
                    });
                    openInvoices = openList.data || [];
                } catch (err: any) {
                    console.warn('Could not list open invoices:', err?.message);
                }

                try {
                    const invoicesApi = stripe.invoices as any;
                    if (typeof invoicesApi.retrieveUpcoming === 'function') {
                        upcomingInvoice = await invoicesApi.retrieveUpcoming({ customer: profile.stripe_customer_id });
                    } else if (typeof invoicesApi.upcoming === 'function') {
                        upcomingInvoice = await invoicesApi.upcoming({ customer: profile.stripe_customer_id });
                    }
                } catch {
                    // Normal when no upcoming invoice is scheduled
                }

                try {
                    const chargesList = await stripe.charges.list({
                        customer: profile.stripe_customer_id,
                        limit: 100
                    });
                    stripeCharges = chargesList.data || [];
                } catch (err: any) {
                    console.warn('Could not list charges:', err?.message);
                }
            }
        } catch (err: any) {
            console.error('Stripe retrieval error in getTenantDetails:', err);
        }
    }

    // 5. Determine Resolved Tier
    let detectedTierName = stripeSub?.metadata?.tierName;
    if (!detectedTierName && stripeSub?.items?.data) {
        for (const item of stripeSub.items.data) {
            const priceId = item.price?.id;
            for (const [key, cfg] of Object.entries(PRICING_TIERS)) {
                if (cfg.stripePriceId === priceId || cfg.stripeMeteredPriceId === priceId) {
                    detectedTierName = key;
                    break;
                }
            }
            if (detectedTierName) break;
        }
    }
    if (!detectedTierName) {
        detectedTierName = profile.tier_name || profile.tier || DEFAULT_TIER;
    }

    const lowerTier = String(detectedTierName).toLowerCase();
    const matchedKey = Object.keys(PRICING_TIERS).find(k => k.toLowerCase() === lowerTier) ||
        (lowerTier === 'pro' ? 'Professional' : DEFAULT_TIER);
    const resolvedTierName = matchedKey as TierName;
    const tierConfig = PRICING_TIERS[resolvedTierName] || PRICING_TIERS[DEFAULT_TIER];

    // 6. How Much They Are Paying
    let basePrice = tierConfig.price;
    let billingInterval = 'month';

    if (stripeSub?.items?.data) {
        const recurringItem = stripeSub.items.data.find((i: any) =>
            i.price?.recurring?.usage_type !== 'metered' && i.price?.type === 'recurring'
        );
        if (recurringItem?.price?.unit_amount !== undefined && recurringItem?.price?.unit_amount !== null) {
            basePrice = (recurringItem.price.unit_amount * (recurringItem.quantity || 1)) / 100;
            billingInterval = recurringItem.price.recurring?.interval || 'month';
        }
    }

    const pendingOverageBalance = Number(profile.pending_overage_balance) || 0;
    const currentOverageCount = Number(profile.current_overage_count) || 0;
    const currentCycleEstimatedTotal = parseFloat((basePrice + pendingOverageBalance).toFixed(2));

    // 7. How Much They Have Spent (Total Spent)
    const paidInvoicesTotal = paidInvoices.reduce((sum, inv) => sum + ((inv.amount_paid || 0) / 100), 0);
    const directChargesTotal = stripeCharges
        .filter(c => c.paid && !c.refunded && !c.invoice)
        .reduce((sum, c) => sum + ((c.amount - (c.amount_refunded || 0)) / 100), 0);

    let totalSpent = parseFloat((paidInvoicesTotal + directChargesTotal).toFixed(2));
    if (totalSpent === 0 && profile.onboarding_fee_paid) {
        totalSpent = tierConfig.onboardingFee;
    }

    // 8. Next Payment Due Date & Days Remaining
    let nextPaymentDueDate: string | null = null;
    if (upcomingInvoice?.next_payment_attempt) {
        nextPaymentDueDate = new Date(upcomingInvoice.next_payment_attempt * 1000).toISOString();
    } else if (stripeSub?.current_period_end) {
        nextPaymentDueDate = new Date(stripeSub.current_period_end * 1000).toISOString();
    } else if (profile.subscription_start_date || profile.created_at) {
        const start = new Date(profile.subscription_start_date || profile.created_at);
        const nowTime = Date.now();
        let nextDate = new Date(start);
        while (nextDate.getTime() <= nowTime) {
            nextDate.setMonth(nextDate.getMonth() + 1);
        }
        nextPaymentDueDate = nextDate.toISOString();
    }

    let daysRemaining: number | null = null;
    if (nextPaymentDueDate) {
        daysRemaining = Math.ceil((new Date(nextPaymentDueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    }

    // 9. Past Due Check
    const nowSec = Math.floor(Date.now() / 1000);
    const hasOverdueInvoice = openInvoices.some(inv =>
        (inv.due_date && inv.due_date < nowSec) || (inv.attempt_count > 0 && !inv.paid)
    );
    const isStatusPastDue = stripeSub?.status === 'past_due' || stripeSub?.status === 'unpaid' ||
        profile.subscription_status === 'past_due' || profile.subscription_status === 'unpaid';
    const isPastDue = isStatusPastDue || hasOverdueInvoice;

    const pastDueAmount = parseFloat(openInvoices.reduce((sum, inv) => sum + ((inv.amount_due || 0) / 100), 0).toFixed(2));

    // 10. Last Payment Date
    let lastPaymentDate: string | null = null;
    if (paidInvoices.length > 0) {
        const sorted = [...paidInvoices].sort((a, b) => b.created - a.created);
        if (sorted[0]?.status_transitions?.paid_at) {
            lastPaymentDate = new Date(sorted[0].status_transitions.paid_at * 1000).toISOString();
        } else if (sorted[0]?.created) {
            lastPaymentDate = new Date(sorted[0].created * 1000).toISOString();
        }
    }

    // 11. Profitability on Tenant
    const roundedModelCostTotal = parseFloat(modelCostTotal.toFixed(2));
    const grossProfit = parseFloat((totalSpent - roundedModelCostTotal).toFixed(2));
    const marginPercent = totalSpent > 0 ? parseFloat((((totalSpent - roundedModelCostTotal) / totalSpent) * 100).toFixed(1)) : 0;

    return {
        profile,
        leads: leads || [],
        billing: {
            tier: resolvedTierName,
            tierConfig: {
                name: tierConfig.name,
                price: tierConfig.price,
                allowance: tierConfig.allowance,
                overageRate: tierConfig.overageRate,
                billingThreshold: tierConfig.billingThreshold,
                onboardingFee: tierConfig.onboardingFee,
                features: tierConfig.features
            },
            amountPaying: {
                basePrice,
                interval: billingInterval,
                overageRate: tierConfig.overageRate,
                pendingOverageBalance,
                currentOverageCount,
                currentCycleEstimatedTotal
            },
            totalSpent,
            nextPaymentDueDate,
            daysRemaining,
            isPastDue,
            pastDueAmount,
            subscriptionStatus: stripeSub?.status || profile.subscription_status || 'inactive',
            stripeCustomerId: profile.stripe_customer_id || null,
            stripeSubscriptionId: profile.stripe_subscription_id || null,
            cancelAtPeriodEnd: stripeSub?.cancel_at_period_end || false,
            hasStripeAccount: !!profile.stripe_customer_id,
            lastPaymentDate,
            paidInvoicesCount: paidInvoices.length
        },
        generations: {
            counts: {
                day: dayCount,
                month: monthCount,
                year: yearCount,
                total: totalCount,
                adminTests: adminTestsCount
            },
            modelCost: {
                day: parseFloat(modelCostDay.toFixed(2)),
                month: parseFloat(modelCostMonth.toFixed(2)),
                year: parseFloat(modelCostYear.toFixed(2)),
                total: roundedModelCostTotal
            },
            profitability: {
                revenue: totalSpent,
                cost: roundedModelCostTotal,
                grossProfit,
                marginPercent
            },
            dailyBreakdown,
            monthlyBreakdown,
            recent: recentGenerations
        }
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
        .order('updated_at', { ascending: false }) // Fallback tiebreaker
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
    negative_prompt?: string | null;
    description?: string;
    created_at?: string;
    is_active?: boolean;
}

export async function createSystemPrompt(key: string, instruction: string, template: string, negativePrompt?: string) {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return { error: 'Unauthorized' };

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
            negative_prompt: negativePrompt || null,
            is_active: false // Default to inactive
        });

    if (error) return { error: error.message };
    return { success: true };
}

export async function setActivePrompt(key: string) {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return { error: 'Unauthorized' };

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
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return { error: 'Unauthorized' };

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
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return [];

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
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return 'Unauthorized';

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
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return { error: 'Unauthorized' };

    console.log('[DEBUG] testDesignGeneration called via Admin Dashboard');

    // 1. Extract Inputs
    const imageFile = formData.get('image') as File;
    const styleFile = formData.get('style_image') as File;
    const systemInstruction = formData.get('system_instruction') as string;
    const userTemplate = formData.get('user_template') as string;
    const negativePrompt = formData.get('negative_prompt') as string;

    if (!imageFile || !styleFile) {
        return { error: 'Both Source Image and Style Image are required for testing.' };
    }

    try {
        // 2. Prepare Base64
        const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
        const base64Image = imageBuffer.toString('base64');

        const styleBuffer = Buffer.from(await styleFile.arrayBuffer());
        const base64Style = styleBuffer.toString('base64');
        const styleInput = { base64StyleImages: [base64Style] };

        // 3. Prepare Config
        const promptConfig = {
            systemInstruction: systemInstruction,
            userTemplate: userTemplate,
            negative_prompt: negativePrompt
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

// SUBSCRIPTION MANAGEMENT
export async function updateSubscriptionStatus(tenantId: string, status: 'active' | 'cancelled') {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return { error: 'Unauthorized' };

    const supabase = createAdminClient();
    if (!supabase) return { error: 'Admin client missing' };

    try {
        const { error } = await supabase
            .from('profiles')
            .update({ subscription_status: status })
            .eq('id', tenantId);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('Update Subscription Failed:', error);
        return { error: error.message };
    }
}

// COST ANALYSIS
export async function getCostAnalysis(dateRange?: { from?: string, to?: string }, groupBy: 'day' | 'week' | 'month' | 'year' = 'day') {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return { error: 'Unauthorized' };

    const supabase = await createAdminClient();
    if (!supabase) return { error: 'Admin client missing' };

    try {
        // Fetch generations with optionally filtered date range
        let query = supabase
            .from('generations')
            .select('model_id, input_tokens, output_tokens, created_at') // Removed cost_usd to fix error
            .order('created_at', { ascending: true }); // Important for bucketing

        if (dateRange?.from) {
            query = query.gte('created_at', dateRange.from);
        }
        if (dateRange?.to) {
            query = query.lte('created_at', dateRange.to);
        }

        const { data, error } = await query;

        if (error) throw error;

        let totalCost = 0;
        let totalGenerations = 0;
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let modelBreakdown: any = {};
        const chartDataMap: Record<string, any> = {};

        data.forEach((gen: any) => {
            const model = gen.model_id || 'unknown';
            const input = gen.input_tokens || 0;
            const output = gen.output_tokens || 0;
            const createdAt = new Date(gen.created_at);

            totalInputTokens += input;
            totalOutputTokens += output;

            // --- COST CALCULATION ---
            let cost = 0;
            let inputCost = 0;
            let outputCost = 0;
            let imageCost = 0;

            // Prefer stored cost if available, else calculate
            if (gen.cost_usd !== undefined && gen.cost_usd !== null) {
                cost = gen.cost_usd;
            } else {
                if (model.includes('flash-image') || model.includes('flash')) {
                    // Gemini 3.1 Flash Image
                    // 1. Input Cost ($0.15 / 1M)
                    inputCost = (input / 1000000) * 0.15;
                    // 2. Output Cost ($0.60 / 1M)
                    outputCost = (output / 1000000) * 0.60;
                    // 3. Fixed Image Cost (~$0.030)
                    imageCost = 0.030;
                    cost = inputCost + outputCost + imageCost;
                } else if (model.includes('gemini-3')) {
                    // Legacy Gemini 3 Pro Image Preview
                    // 1. Input Cost ($2.00 / 1M)
                    inputCost = (input / 1000000) * 2.00;
                    // 2. Output Cost ($12.00 / 1M)
                    outputCost = (output / 1000000) * 12.00;
                    // 3. Fixed Image Cost (~$0.134)
                    imageCost = 0.134;
                    cost = inputCost + outputCost + imageCost;
                } else if (model.includes('imagen')) {
                    imageCost = 0.040;
                    cost = 0.040;
                }
            }

            totalCost += cost;
            totalGenerations++;

            // --- MODEL BREAKDOWN ---
            if (!modelBreakdown[model]) {
                modelBreakdown[model] = { 
                    count: 0, 
                    inputTokens: 0, 
                    outputTokens: 0, 
                    cost: 0,
                    inputCost: 0,
                    outputCost: 0,
                    imageCost: 0
                };
            }
            modelBreakdown[model].count++;
            modelBreakdown[model].inputTokens += input;
            modelBreakdown[model].outputTokens += output;
            modelBreakdown[model].cost += cost;
            modelBreakdown[model].inputCost = (modelBreakdown[model].inputCost || 0) + inputCost;
            modelBreakdown[model].outputCost = (modelBreakdown[model].outputCost || 0) + outputCost;
            modelBreakdown[model].imageCost = (modelBreakdown[model].imageCost || 0) + imageCost;

            // --- CHART BUCKETING ---
            let bucketKey = '';
            let bucketLabel = '';

            if (groupBy === 'year') {
                bucketKey = format(createdAt, 'yyyy');
                bucketLabel = bucketKey;
            } else if (groupBy === 'month') {
                bucketKey = format(createdAt, 'yyyy-MM');
                bucketLabel = format(createdAt, 'MMM yyyy');
            } else {
                // Default to Day
                bucketKey = format(createdAt, 'yyyy-MM-dd');
                bucketLabel = format(createdAt, 'MMM dd');
            }

            if (!chartDataMap[bucketKey]) {
                chartDataMap[bucketKey] = {
                    date: bucketKey,
                    label: bucketLabel,
                    cost: 0,
                    generations: 0,
                    inputTokens: 0
                };
            }

            chartDataMap[bucketKey].cost += cost;
            chartDataMap[bucketKey].generations += 1;
            chartDataMap[bucketKey].inputTokens += input;
        });

        // Convert Map to Array and Sort
        const chartData = Object.values(chartDataMap).sort((a: any, b: any) => a.date.localeCompare(b.date));

        return {
            totalCost,
            totalGenerations,
            totalInputTokens,
            totalOutputTokens,
            modelBreakdown,
            chartData,
            lastUpdated: new Date().toISOString()
        };

    } catch (error: any) {
        console.error('Cost Analysis Failed:', error);
        return { error: error.message };
    }
}

// STORAGE
// STORAGE
export async function listBucketFiles(bucket: string, path: string = '') {
    const { getActingUser } = await import('@/lib/auth-context');
    const { user, isAdmin, isImpersonating, tenantId } = await getActingUser();
    if (!user) return { error: 'Unauthorized' };

    // If not admin and not impersonating, ensure user can only query their own tenant assets
    if (!isAdmin && !isImpersonating) {
        const isOwnPath = !path || path === user.id || path.startsWith(`${user.id}/`) ||
                          (tenantId && (path === tenantId || path.startsWith(`${tenantId}/`)));
        if (!isOwnPath) {
            return { error: 'Unauthorized access to tenant files' };
        }
        if (!path) {
            path = tenantId || user.id;
        }
    }

    const supabase = createAdminClient();
    if (!supabase) return { error: 'Admin client missing' };

    try {
        // 1. Fetch Root Items (Files & Folders)
        const { data: rootItems, error } = await supabase
            .storage
            .from(bucket)
            .list(path, {
                limit: 100,
                offset: 0,
                sortBy: { column: 'name', order: 'asc' },
            });

        if (error) {
            // Folder may not exist in this bucket yet
            return { data: [] };
        }

        const allFiles = [];

        if (rootItems && Array.isArray(rootItems)) {
            for (const item of rootItems) {
                // Identify Folders (items without id or metadata mimetype)
                const isFolder = !item.id || !item.metadata || !item.metadata.mimetype;
                if (isFolder) {
                    const folderPath = path ? `${path}/${item.name}` : item.name;
                    const { data: folderItems, error: folderError } = await supabase
                        .storage
                        .from(bucket)
                        .list(folderPath, { limit: 100 });

                    if (!folderError && folderItems) {
                        for (const fItem of folderItems) {
                            const fileFullPath = `${folderPath}/${fItem.name}`;
                            const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(fileFullPath, 3600);
                            const publicUrl = signedData?.signedUrl || supabase.storage.from(bucket).getPublicUrl(fileFullPath)?.data?.publicUrl;
                            allFiles.push({ ...fItem, bucket, name: `${item.name}/${fItem.name}`, publicUrl });
                        }
                    }
                } else {
                    const fileFullPath = path ? `${path}/${item.name}` : item.name;
                    const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(fileFullPath, 3600);
                    const publicUrl = signedData?.signedUrl || supabase.storage.from(bucket).getPublicUrl(fileFullPath)?.data?.publicUrl;
                    allFiles.push({ ...item, bucket, publicUrl });
                }
            }
        }

        return { data: allFiles };
    } catch (error: any) {
        console.error(`List Bucket (${bucket}) Failed:`, error);
        return { data: [] };
    }
}

export async function deleteTenant(tenantId: string) {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return { error: 'Unauthorized' };

    const supabase = createAdminClient();
    if (!supabase) return { error: 'Admin client missing' };

    try {
        const { error } = await supabase.auth.admin.deleteUser(tenantId);
        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('Delete Tenant Failed:', error);
        return { error: error.message };
    }
}

// UPDATE TENANT CREDENTIALS & PROFILE
export async function updateTenantCredentials(
    tenantId: string,
    data: { email?: string; shopName?: string; phone?: string; website?: string }
) {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return { error: 'Unauthorized' };

    const supabase = createAdminClient();
    if (!supabase) return { error: 'Admin client missing' };

    try {
        const { email, shopName, phone, website } = data;

        // 1. Fetch current profile
        const { data: currentProfile, error: profileFetchErr } = await supabase
            .from('profiles')
            .select('email, shop_name')
            .eq('id', tenantId)
            .single();

        if (profileFetchErr) {
            return { error: 'Tenant profile not found: ' + profileFetchErr.message };
        }

        const cleanEmail = email?.trim().toLowerCase();

        // 2. If email is changing, update auth.users
        if (cleanEmail && cleanEmail !== currentProfile?.email?.toLowerCase()) {
            const { error: authError } = await supabase.auth.admin.updateUserById(tenantId, {
                email: cleanEmail,
                email_confirm: true,
                user_metadata: {
                    ...(shopName ? { full_name: shopName.trim() } : {}),
                }
            });

            if (authError) {
                console.error('Auth email update error:', authError);
                return { error: 'Failed to update login email: ' + authError.message };
            }
        } else if (shopName) {
            // Update auth metadata name if shopName changed
            await supabase.auth.admin.updateUserById(tenantId, {
                user_metadata: { full_name: shopName.trim() }
            });
        }

        // 3. Update public.profiles
        const profileUpdates: Record<string, any> = {
            updated_at: new Date().toISOString(),
        };

        if (cleanEmail) profileUpdates.email = cleanEmail;
        if (shopName !== undefined) profileUpdates.shop_name = shopName.trim();
        if (phone !== undefined) profileUpdates.phone = phone.trim();
        if (website !== undefined) profileUpdates.website = website.trim();

        const { error: profileUpdateErr } = await supabase
            .from('profiles')
            .update(profileUpdates)
            .eq('id', tenantId);

        if (profileUpdateErr) {
            console.error('Profile update error:', profileUpdateErr);
            return { error: 'Failed to update profile record: ' + profileUpdateErr.message };
        }

        return {
            success: true,
            updated: {
                email: cleanEmail || currentProfile?.email,
                shop_name: shopName?.trim() || currentProfile?.shop_name,
                phone,
                website,
            }
        };
    } catch (error: any) {
        console.error('updateTenantCredentials Failed:', error);
        return { error: error.message || 'Failed to update tenant' };
    }
}

// SEND PASSWORD RESET TO TENANT
export async function sendTenantPasswordReset(tenantId: string) {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return { error: 'Unauthorized' };

    const supabase = createAdminClient();
    if (!supabase) return { error: 'Admin client missing' };

    try {
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('email, shop_name')
            .eq('id', tenantId)
            .single();

        if (profileError || !profile?.email) {
            return { error: 'Tenant profile or email not found' };
        }

        const email = profile.email.trim();

        // Build redirect URL based on request headers
        const { headers } = await import('next/headers');
        const headersList = await headers();
        const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'localhost:3000';
        const proto = headersList.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
        const origin = `${proto}://${host}`;
        const redirectTo = `${origin}/auth/callback?next=/reset-password`;

        // 1. Send reset email via Supabase Auth
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo,
        });

        // 2. Generate direct link as fallback/convenience for admin
        let directLink: string | null = null;
        try {
            const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
                type: 'recovery',
                email,
                options: {
                    redirectTo,
                },
            });

            if (!linkError && linkData?.properties?.action_link) {
                directLink = linkData.properties.action_link;
            }
        } catch (linkGenErr) {
            console.warn('Could not generate direct recovery link:', linkGenErr);
        }

        if (resetError && !directLink) {
            throw resetError;
        }

        return {
            success: true,
            email,
            directLink,
            emailSent: !resetError,
            errorNote: resetError ? resetError.message : undefined,
        };
    } catch (error: any) {
        console.error('sendTenantPasswordReset Failed:', error);
        return { error: error.message || 'Failed to send password reset' };
    }
}

export async function testTenantStyle(formData: FormData) {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return { error: 'Unauthorized: Admin privileges required.' };

    // Explicitly enforce admin test mode so zero charges/usage are billed to the tenant
    formData.set('is_admin_test', 'true');

    const startTime = Date.now();
    const { generateDesign } = await import('@/app/actions/ai');
    const result = await generateDesign(formData);
    const durationMs = Date.now() - startTime;

    if (result.success && result.image) {
        return {
            success: true,
            image: result.image,
            durationMs,
            usage: (result as any).usage,
            zeroChargeConfirmed: true
        };
    }

    return {
        success: false,
        error: result.error || 'Generation failed'
    };
}

