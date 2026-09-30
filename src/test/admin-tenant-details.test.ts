import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCheckIsAdmin = vi.fn();
const mockProfileSingle = vi.fn();
const mockLeadsLimit = vi.fn();
const mockGenerationsOrder = vi.fn();

vi.mock('@/lib/auth-utils', () => ({
    checkIsAdmin: () => mockCheckIsAdmin(),
}));

vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: vi.fn(() => ({
        from: vi.fn((table: string) => {
            if (table === 'profiles') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: mockProfileSingle,
                        })),
                    })),
                };
            }
            if (table === 'leads') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            order: vi.fn(() => ({
                                limit: mockLeadsLimit,
                            })),
                        })),
                    })),
                };
            }
            if (table === 'generations') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            order: mockGenerationsOrder,
                        })),
                    })),
                };
            }
            return { select: vi.fn() };
        }),
    })),
}));

vi.mock('@/lib/stripe', () => ({
    stripe: {
        subscriptions: {
            retrieve: vi.fn().mockResolvedValue({
                id: 'sub_test_123',
                status: 'active',
                current_period_end: Math.floor(Date.now() / 1000) + 86400 * 14,
                metadata: { tierName: 'Professional' },
                items: {
                    data: [
                        {
                            price: {
                                id: 'price_pro_test',
                                type: 'recurring',
                                unit_amount: 5000,
                                recurring: { interval: 'month', usage_type: 'licensed' }
                            },
                            quantity: 1
                        }
                    ]
                }
            }),
            list: vi.fn().mockResolvedValue({ data: [] })
        },
        invoices: {
            list: vi.fn().mockImplementation(({ status }) => {
                if (status === 'paid') {
                    return Promise.resolve({
                        data: [
                            { id: 'inv_1', amount_paid: 5000, status_transitions: { paid_at: 1700000000 } },
                            { id: 'inv_2', amount_paid: 5000, status_transitions: { paid_at: 1702592000 } }
                        ]
                    });
                }
                return Promise.resolve({ data: [] });
            }),
            retrieveUpcoming: vi.fn().mockRejectedValue(new Error('No upcoming invoice'))
        },
        charges: {
            list: vi.fn().mockResolvedValue({ data: [] })
        }
    }
}));

describe('getTenantDetails Admin Action', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckIsAdmin.mockResolvedValue(true);
        process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
    });

    it('returns unauthorized if user is not admin', async () => {
        mockCheckIsAdmin.mockResolvedValue(false);
        const { getTenantDetails } = await import('@/app/admin/actions');
        const res = await getTenantDetails('tenant-123');
        expect(res).toBeNull();
    });

    it('calculates tier, amount paying, generations by day/month/year, total spent, and admin model cost', async () => {
        const now = new Date();
        const todayIso = now.toISOString();
        const thisMonthIso = new Date(now.getFullYear(), now.getMonth(), 2).toISOString();
        const lastYearIso = new Date(now.getFullYear() - 1, 5, 10).toISOString();

        mockProfileSingle.mockResolvedValue({
            data: {
                id: 'tenant-123',
                shop_name: 'Ironworks Pro',
                email: 'owner@ironworks.com',
                subscription_status: 'active',
                tier_name: 'Professional',
                stripe_customer_id: 'cus_123',
                stripe_subscription_id: 'sub_123',
                pending_overage_balance: 10
            },
            error: null
        });

        mockLeadsLimit.mockResolvedValue({
            data: [{ id: 'lead_1', customer_name: 'Alice', email: 'alice@test.com', status: 'New', created_at: todayIso }]
        });

        mockGenerationsOrder.mockResolvedValue({
            data: [
                {
                    id: 'gen_1',
                    created_at: todayIso,
                    model_id: 'gemini-3.1-flash-image',
                    input_tokens: 1000,
                    output_tokens: 500,
                    prompt_used: 'Iron stair rail'
                },
                {
                    id: 'gen_2',
                    created_at: thisMonthIso,
                    model_id: 'gemini-3.1-flash-image',
                    input_tokens: 1000,
                    output_tokens: 500,
                    prompt_used: 'Modern rail'
                },
                {
                    id: 'gen_3',
                    created_at: lastYearIso,
                    model_id: 'gemini-3.1-flash-image',
                    input_tokens: 2000,
                    output_tokens: 1000,
                    prompt_used: 'Rustic railing'
                }
            ]
        });

        const { getTenantDetails } = await import('@/app/admin/actions');
        const res = await getTenantDetails('tenant-123');

        expect(res).not.toBeNull();
        if (!res) return;

        // 1. Tier
        expect(res.billing.tier).toBe('Professional');
        
        // 2. Amount Paying
        expect(res.billing.amountPaying.basePrice).toBe(50);
        expect(res.billing.amountPaying.interval).toBe('month');
        expect(res.billing.amountPaying.pendingOverageBalance).toBe(10);
        expect(res.billing.amountPaying.currentCycleEstimatedTotal).toBe(60);

        // 3. Generations count by day, month, year, total
        expect(res.generations.counts.day).toBeGreaterThanOrEqual(1);
        expect(res.generations.counts.month).toBeGreaterThanOrEqual(2);
        expect(res.generations.counts.total).toBe(3);

        // 4. Total spent ($50 + $50 = $100 from paid invoices)
        expect(res.billing.totalSpent).toBe(100);

        // 5. Admin model cost paid
        expect(res.generations.modelCost.total).toBeGreaterThan(0);
        expect(res.generations.profitability.revenue).toBe(100);
        expect(res.generations.profitability.grossProfit).toBeGreaterThan(90);

        // 6. Next payment due date
        expect(res.billing.nextPaymentDueDate).toBeTruthy();
        expect(res.billing.daysRemaining).toBeGreaterThan(0);

        // 7. Is past due
        expect(res.billing.isPastDue).toBe(false);
    });

    it('flags past due properly when subscription or invoice is past due', async () => {
        mockProfileSingle.mockResolvedValue({
            data: {
                id: 'tenant-past-due',
                shop_name: 'Overdue Metal',
                email: 'late@metal.com',
                subscription_status: 'past_due',
                tier_name: 'Starter'
            },
            error: null
        });

        mockLeadsLimit.mockResolvedValue({ data: [] });
        mockGenerationsOrder.mockResolvedValue({ data: [] });

        const { getTenantDetails } = await import('@/app/admin/actions');
        const res = await getTenantDetails('tenant-past-due');

        expect(res).not.toBeNull();
        expect(res?.billing.isPastDue).toBe(true);
    });

    it('correctly handles $350 initial payment on Sept 21st, Volume tier 0.80 base price with credits, and avoids $700 double counting', async () => {
        const { stripe } = await import('@/lib/stripe');

        // Initial payment on September 21, 2026 (timestamp: 1789948800)
        const sept21Timestamp = Math.floor(new Date('2026-09-21T12:00:00Z').getTime() / 1000);

        (stripe.invoices.list as any).mockImplementation(({ status }: any) => {
            if (status === 'paid') {
                return Promise.resolve({
                    data: [
                        {
                            id: 'inv_ags_350',
                            amount_paid: 35000,
                            payment_intent: 'pi_ags_350',
                            charge: 'ch_ags_350',
                            status_transitions: { paid_at: sept21Timestamp }
                        }
                    ]
                });
            }
            return Promise.resolve({ data: [] });
        });

        // The checkout session created a charge for $350 with matching payment_intent
        (stripe.charges.list as any).mockResolvedValue({
            data: [
                {
                    id: 'ch_ags_350',
                    amount: 35000,
                    amount_refunded: 0,
                    paid: true,
                    refunded: false,
                    payment_intent: 'pi_ags_350',
                    invoice: null // Checkout session charges often have invoice as null
                }
            ]
        });

        (stripe.subscriptions.retrieve as any).mockRejectedValue(new Error('No subscription'));
        (stripe.subscriptions.list as any).mockResolvedValue({ data: [] });

        mockProfileSingle.mockResolvedValue({
            data: {
                id: 'tenant-ags',
                shop_name: 'AGS Stainless',
                email: 'paul@agsstainless.com',
                subscription_status: 'active',
                tier_name: 'Volume',
                stripe_customer_id: 'cus_UdFl4Mfjie3Gvz',
                stripe_subscription_id: null,
                subscription_start_date: '2026-09-21T00:00:00.000Z',
                pending_overage_balance: 14.40,
                current_overage_count: 12,
                free_credits_remaining: 50,
                discounted_credits_remaining: 150,
                discounted_rate: 0.40,
                pending_discounted_amount: 0.00,
                pending_discounted_count: 0
            },
            error: null
        });

        mockLeadsLimit.mockResolvedValue({ data: [] });
        mockGenerationsOrder.mockResolvedValue({
            data: [
                {
                    id: 'gen_ags_1',
                    created_at: '2026-09-25T10:00:00Z',
                    model_id: 'gemini-3.1-flash-image',
                    input_tokens: 1200,
                    output_tokens: 600,
                    prompt_used: 'Stainless steel cable railing'
                }
            ]
        });

        const { getTenantDetails } = await import('@/app/admin/actions');
        const res = await getTenantDetails('tenant-ags');

        expect(res).not.toBeNull();
        if (!res) return;

        // 1. Did NOT double count $350 invoice + $350 charge to $700
        expect(res.billing.totalSpent).toBe(350.00);

        // 2. Next payment due date is October 21st (1 month from September 21st)
        expect(res.billing.nextPaymentDueDate).toBeTruthy();
        const dueDate = new Date(res.billing.nextPaymentDueDate!);
        expect(dueDate.getUTCMonth()).toBe(9); // 0-indexed: 9 is October
        expect(dueDate.getUTCDate()).toBe(21);

        // 3. Amount paying card checks:
        // Base subscription fee is 100 for Volume tier
        expect(res.billing.amountPaying.basePrice).toBe(100);
        // Base overage render rate is 0.80 for Volume tier
        expect(res.billing.amountPaying.overageRate).toBe(0.80);
        // Because free_credits_remaining is 50, activeRateLabel reflects free credits
        expect(res.billing.amountPaying.activeRateLabel).toContain('Free Credits Active');
        // Current cycle estimate includes base (100) + pending overage (14.40) = 114.40
        expect(res.billing.amountPaying.currentCycleEstimatedTotal).toBe(114.40);

        // 4. Activity card shows the generation and non-zero counts
        expect(res.generations.counts.total).toBe(1);
        expect(res.generations.modelCost.total).toBeGreaterThan(0);
        expect(res.generations.profitability.revenue).toBe(350.00);
        expect(res.generations.profitability.grossProfit).toBeCloseTo(350 - res.generations.modelCost.total, 2);
    });
});
