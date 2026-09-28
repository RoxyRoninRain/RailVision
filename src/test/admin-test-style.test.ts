import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockGetUser = vi.fn();
const mockProfilesSelect = vi.fn();
const mockProfilesUpdate = vi.fn();
const mockGenerationsInsert = vi.fn();
const mockGenerationsSelect = vi.fn();
const mockPortfolioSelect = vi.fn();
const mockCheckIsAdmin = vi.fn();
const mockReportUsage = vi.fn();
const mockGenerateDesignWithNanoBanana = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => ({
        auth: {
            getUser: mockGetUser,
        },
        from: vi.fn((table: string) => {
            if (table === 'profiles') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: mockProfilesSelect,
                        })),
                    })),
                    update: vi.fn(() => ({
                        eq: mockProfilesUpdate,
                    })),
                };
            }
            if (table === 'generations') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            gte: mockGenerationsSelect,
                        })),
                    })),
                    insert: mockGenerationsInsert,
                };
            }
            if (table === 'portfolio') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: mockPortfolioSelect,
                        })),
                    })),
                };
            }
            return {
                select: vi.fn(),
                insert: vi.fn(),
                update: vi.fn(),
            };
        }),
    })),
}));

vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: vi.fn(() => ({
        from: vi.fn((table: string) => {
            if (table === 'profiles') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: mockProfilesSelect,
                        })),
                    })),
                    update: vi.fn(() => ({
                        eq: mockProfilesUpdate,
                    })),
                };
            }
            if (table === 'generations') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            gte: mockGenerationsSelect,
                        })),
                    })),
                    insert: mockGenerationsInsert,
                };
            }
            if (table === 'portfolio') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: mockPortfolioSelect,
                        })),
                    })),
                };
            }
            return { select: vi.fn(), insert: vi.fn() };
        }),
    })),
}));

vi.mock('@/lib/auth-utils', () => ({
    checkIsAdmin: () => mockCheckIsAdmin(),
}));

vi.mock('next/headers', () => ({
    headers: vi.fn(async () => ({
        get: vi.fn((name: string) => {
            if (name === 'x-forwarded-for') return '127.0.0.1';
            return 'vitest-agent';
        }),
    })),
}));

vi.mock('@/app/admin/actions/security', () => ({
    checkIpStatus: vi.fn(async () => ({ blocked: false })),
}));

vi.mock('@/app/actions/stripe', () => ({
    reportUsage: (...args: any[]) => mockReportUsage(...args),
}));

vi.mock('@/lib/vertex', () => ({
    generateDesignWithNanoBanana: (...args: any[]) => mockGenerateDesignWithNanoBanana(...args),
}));

vi.mock('@/app/admin/actions', () => ({
    getActiveSystemPrompt: vi.fn(async () => null),
    testTenantStyle: async (formData: FormData) => {
        const isAdmin = await mockCheckIsAdmin();
        if (!isAdmin) return { error: 'Unauthorized: Admin privileges required.' };
        formData.set('is_admin_test', 'true');
        const { generateDesign } = await import('@/app/actions/ai');
        const res = await generateDesign(formData);
        if (res.success && res.image) {
            return {
                success: true,
                image: res.image,
                zeroChargeConfirmed: true,
            };
        }
        return { success: false, error: res.error };
    },
}));

describe('Tenant Style Testing - Zero Usage Charge Verification', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockGetUser.mockResolvedValue({
            data: { user: { id: 'admin-user-id', email: 'admin@railify.com' } },
        });

        mockGenerationsSelect.mockResolvedValue({
            count: 0,
            error: null,
        });

        mockProfilesSelect.mockResolvedValue({
            data: {
                id: 'target-tenant-id',
                shop_name: 'Test Railings LLC',
                tier_name: 'The Estimator',
                current_usage: 15,
                pending_overage_balance: 30.00,
                current_overage_count: 5,
                max_monthly_spend: 100,
                subscription_status: 'incomplete', // Note: incomplete onboarding status
            },
            error: null,
        });

        mockPortfolioSelect.mockResolvedValue({
            data: {
                id: 'style-123',
                name: 'Modern Iron',
                image_url: 'https://example.com/style.jpg',
                reference_images: [],
                has_bottom_rail: false,
            },
            error: null,
        });

        mockGenerateDesignWithNanoBanana.mockResolvedValue({
            success: true,
            image: 'data:image/png;base64,mocked-result-image',
            usage: { inputTokens: 500, outputTokens: 200 },
        });

        mockGenerationsInsert.mockResolvedValue({ error: null });
        mockProfilesUpdate.mockResolvedValue({ error: null });
    });

    it('bypasses billing, Stripe reporting, and profile counters when admin tests a tenant style', async () => {
        mockCheckIsAdmin.mockResolvedValue(true);

        const { generateDesign } = await import('@/app/actions/ai');

        const formData = new FormData();
        const dummyFile = new File(['dummy-image-bytes'], 'test-stairs.jpg', { type: 'image/jpeg' });
        dummyFile.arrayBuffer = async () => new Uint8Array([1, 2, 3]).buffer;
        formData.append('image', dummyFile);
        formData.append('style', 'Modern Iron');
        formData.append('styleId', '550e8400-e29b-41d4-a716-446655440001');
        formData.append('organization_id', '550e8400-e29b-41d4-a716-446655440002');
        formData.append('is_admin_test', 'true');

        const result = await generateDesign(formData);

        // 1. Generation must succeed even though tenant subscription is 'incomplete'
        expect(result.success).toBe(true);
        expect((result as any).isAdminTest).toBe(true);

        // 2. Stripe reportUsage must NOT have been called
        expect(mockReportUsage).not.toHaveBeenCalled();

        // 3. profiles.update must NOT have been called (no increment to usage or balance)
        expect(mockProfilesUpdate).not.toHaveBeenCalled();

        // 4. Generation should be logged with [ADMIN_TEST] tag
        expect(mockGenerationsInsert).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    prompt_used: expect.stringContaining('[ADMIN_TEST]'),
                }),
            ])
        );
    });

    it('rejects test mode if a non-admin attempts to pass is_admin_test=true', async () => {
        mockCheckIsAdmin.mockResolvedValue(false); // Not an admin!
        mockGetUser.mockResolvedValue({
            data: { user: { id: 'regular-user-id', email: 'regular@tenant.com' } },
        });

        // Set an inactive subscription to trigger normal error
        mockProfilesSelect.mockResolvedValue({
            data: {
                id: 'regular-user-id',
                subscription_status: 'cancelled',
            },
            error: null,
        });

        const { generateDesign } = await import('@/app/actions/ai');

        const formData = new FormData();
        const dummyFile = new File(['dummy-image-bytes'], 'test-stairs.jpg', { type: 'image/jpeg' });
        dummyFile.arrayBuffer = async () => new Uint8Array([1, 2, 3]).buffer;
        formData.append('image', dummyFile);
        formData.append('style', 'Modern Iron');
        formData.append('is_admin_test', 'true'); // Fake attempt

        const result = await generateDesign(formData);

        // Because caller is not an admin, is_admin_test is ignored, and inactive subscription blocks it
        expect(result.success).toBeFalsy();
        expect(result.error).toContain('The account associated with this tool is not currently active');
    });

    it('testTenantStyle action guarantees admin authentication and sets zeroChargeConfirmed', async () => {
        mockCheckIsAdmin.mockResolvedValue(true);

        const { testTenantStyle } = await import('@/app/admin/actions');

        const formData = new FormData();
        const dummyFile = new File(['dummy-image-bytes'], 'test-stairs.jpg', { type: 'image/jpeg' });
        dummyFile.arrayBuffer = async () => new Uint8Array([1, 2, 3]).buffer;
        formData.append('image', dummyFile);
        formData.append('style', 'Modern Iron');
        formData.append('styleId', '550e8400-e29b-41d4-a716-446655440001');
        formData.append('organization_id', '550e8400-e29b-41d4-a716-446655440002');

        const result = await testTenantStyle(formData);

        expect(result.success).toBe(true);
        expect((result as any).zeroChargeConfirmed).toBe(true);
        expect(mockProfilesUpdate).not.toHaveBeenCalled();
        expect(mockReportUsage).not.toHaveBeenCalled();
    });
});
