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
});
