import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetRateLimitBuckets } from '@/lib/rate-limit';

const VALID_JPEG_BYTES = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]);

const mockGenerateDesignWithNanoBanana = vi.fn();
const mockRefineDesignWithNanoBanana = vi.fn();
const mockReportUsage = vi.fn();
const mockCheckIsAdmin = vi.fn();

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

vi.mock('@/lib/vertex', () => ({
    generateDesignWithNanoBanana: (...args: any[]) => mockGenerateDesignWithNanoBanana(...args),
    refineDesignWithNanoBanana: (...args: any[]) => mockRefineDesignWithNanoBanana(...args),
    assembleRefinementPrompt: vi.fn(() => 'Targeted micro-refinement prompt for flush welds'),
}));

vi.mock('@/app/actions/stripe', () => ({
    reportUsage: (...args: any[]) => mockReportUsage(...args),
}));

vi.mock('@/app/admin/actions', () => ({
    getActiveSystemPrompt: vi.fn(async () => ({
        key: 'gemini-handrail-main',
        system_instruction: 'Standard system instruction',
        user_template: 'Input Scene: {{image}}\nStyle Target: {{style}}',
        negative_prompt: 'watermark, blurry'
    })),
}));

const mockProfileUpdate = vi.fn(async (_payload?: any) => ({ error: null }));
const mockGenerationsInsert = vi.fn(async (_payload?: any) => ({ error: null }));

const mockFrom = vi.fn((table: string) => {
    if (table === 'profiles') {
        return {
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn(async () => ({
                        data: {
                            id: '550e8400-e29b-41d4-a716-446655440000',
                            subscription_status: 'active',
                            current_usage: 10,
                            tier_name: 'Showroom',
                            pending_overage_balance: 0,
                            current_overage_count: 0,
                            enable_overdrive: true,
                            stripe_customer_id: 'cus_456',
                            stripe_subscription_id: 'sub_456',
                        },
                        error: null,
                    })),
                })),
            })),
            update: vi.fn((payload) => {
                mockProfileUpdate(payload);
                return {
                    eq: vi.fn(async () => ({ error: null })),
                };
            }),
        };
    }
    if (table === 'portfolio') {
        return {
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn(async () => ({
                        data: {
                            id: '327247e9-8b3e-4b4c-857b-59dcffe4b83b',
                            name: 'Rainier - TM - Round Top',
                            description: 'Modern cable rail with round top rail',
                            image_url: 'https://example.com/main.jpg',
                            reference_images: [],
                            has_bottom_rail: false,
                            has_reducers: false,
                            style_metadata: {
                                second_pass: {
                                    enabled: true,
                                    targets: ['reducers'],
                                    custom_prompt: ''
                                }
                            }
                        },
                        error: null
                    }))
                }))
            }))
        };
    }
    if (table === 'generations') {
        return {
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    gte: vi.fn(async () => ({ count: 0, error: null })),
                })),
            })),
            insert: vi.fn((payload) => {
                mockGenerationsInsert(payload);
                return Promise.resolve({ error: null });
            }),
        };
    }
    return {
        select: vi.fn(() => ({ eq: vi.fn() })),
    };
});

vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: vi.fn(() => ({
        from: mockFrom,
    })),
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        from: mockFrom,
        auth: {
            getUser: vi.fn(async () => ({
                data: { user: { id: '550e8400-e29b-41d4-a716-446655440000', email: 'owner@shop.com' } },
                error: null,
            })),
        },
    })),
}));

describe('Second-Pass Billing Verification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetRateLimitBuckets();
        mockCheckIsAdmin.mockResolvedValue(false);

        global.fetch = vi.fn(async () => ({
            ok: true,
            arrayBuffer: async () => VALID_JPEG_BYTES.slice().buffer,
        } as any));

        mockGenerateDesignWithNanoBanana.mockResolvedValue({
            success: true,
            image: 'data:image/jpeg;base64,pass1_output_image_data',
            usage: { inputTokens: 500, outputTokens: 300 }
        });

        mockRefineDesignWithNanoBanana.mockResolvedValue({
            success: true,
            image: 'data:image/jpeg;base64,pass2_refined_image_data',
            usage: { inputTokens: 400, outputTokens: 250 }
        });
    });

    it('charges the tenant exactly ONCE when second-pass refinement is enabled', async () => {
        const { generateDesign } = await import('@/app/actions/ai');

        const formData = new FormData();
        const fakeFile = new File([VALID_JPEG_BYTES], 'scene.jpg', { type: 'image/jpeg' });
        fakeFile.arrayBuffer = async () => VALID_JPEG_BYTES.slice().buffer;
        formData.append('image', fakeFile);
        formData.append('styleId', '327247e9-8b3e-4b4c-857b-59dcffe4b83b');
        formData.append('style', 'Rainier - TM - Round Top');

        const result = await generateDesign(formData);

        // 1. Verify generation succeeded and returned the Pass 2 refined image
        expect(result.success).toBe(true);
        expect(result.image).toBe('data:image/jpeg;base64,pass2_refined_image_data');
        expect((result as any).secondPassApplied).toBe(true);

        // 2. Verify BOTH Pass 1 and Pass 2 were executed by Vertex
        expect(mockGenerateDesignWithNanoBanana).toHaveBeenCalledTimes(1);
        expect(mockRefineDesignWithNanoBanana).toHaveBeenCalledTimes(1);

        // 3. CRITICAL BILLING CHECK: Stripe reportUsage must be called EXACTLY ONCE
        expect(mockReportUsage).toHaveBeenCalledTimes(1);
        expect(mockReportUsage).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000', 1);

        // 4. CRITICAL PROFILE CHECK: Profile current_usage must be incremented by EXACTLY 1 (from 10 to 11)
        expect(mockProfileUpdate).toHaveBeenCalledTimes(1);
        const updateArgs = (mockProfileUpdate.mock.calls as any)[0][0];
        expect(updateArgs.current_usage).toBe(11); // 10 + 1, NOT 10 + 2

        // 5. CRITICAL AUDIT CHECK: Exactly one generation record must be inserted
        expect(mockGenerationsInsert).toHaveBeenCalledTimes(1);

        // 6. Token usage aggregated for internal analytics without double billing tenant
        expect((result as any).usage).toEqual({
            inputTokens: 900,  // 500 + 400
            outputTokens: 550  // 300 + 250
        });
    });

    it('does not charge the tenant at all in Admin Test Mode even with second pass', async () => {
        mockCheckIsAdmin.mockResolvedValue(true);
        const { generateDesign } = await import('@/app/actions/ai');

        const formData = new FormData();
        const fakeFile = new File([VALID_JPEG_BYTES], 'scene.jpg', { type: 'image/jpeg' });
        fakeFile.arrayBuffer = async () => VALID_JPEG_BYTES.slice().buffer;
        formData.append('image', fakeFile);
        formData.append('styleId', '327247e9-8b3e-4b4c-857b-59dcffe4b83b');
        formData.append('style', 'Rainier - TM - Round Top');
        formData.append('is_admin_test', 'true');
        formData.append('organization_id', '550e8400-e29b-41d4-a716-446655440000');

        const result = await generateDesign(formData);

        expect(result.success).toBe(true);
        expect(mockReportUsage).toHaveBeenCalledTimes(0);
        expect(mockProfileUpdate).toHaveBeenCalledTimes(0);
    });

    it('does not charge the tenant or deduct credits when Pass 1 AI generation fails', async () => {
        mockGenerateDesignWithNanoBanana.mockResolvedValueOnce({
            success: false,
            error: 'Vertex API Error 503: Service Unavailable'
        });

        const { generateDesign } = await import('@/app/actions/ai');

        const formData = new FormData();
        const fakeFile = new File([VALID_JPEG_BYTES], 'scene.jpg', { type: 'image/jpeg' });
        fakeFile.arrayBuffer = async () => VALID_JPEG_BYTES.slice().buffer;
        formData.append('image', fakeFile);
        formData.append('styleId', '327247e9-8b3e-4b4c-857b-59dcffe4b83b');
        formData.append('style', 'Rainier - TM - Round Top');

        const result = await generateDesign(formData);

        expect(result.success).toBe(false);
        expect(mockReportUsage).toHaveBeenCalledTimes(0);
        expect(mockProfileUpdate).toHaveBeenCalledTimes(0);
    });

    it('accumulates Volume tier overages at $0.80/gen without resetting at $20 or $100 mid-month', async () => {
        const { generateDesign } = await import('@/app/actions/ai');

        // Override profile select for this test to simulate a Volume tenant crossing $20 and $100
        mockFrom.mockImplementationOnce((table: string) => {
            if (table === 'generations') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            gte: vi.fn(async () => ({ count: 0, error: null })),
                        })),
                    })),
                } as any;
            }
            return { select: vi.fn() } as any;
        }).mockImplementationOnce((table: string) => {
            if (table === 'profiles') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: vi.fn(async () => ({
                                data: {
                                    id: '550e8400-e29b-41d4-a716-446655440000',
                                    subscription_status: 'active',
                                    current_usage: 125,
                                    tier_name: 'volume', // lowercase to verify case-insensitive resolution
                                    pending_overage_balance: 100.00,
                                    current_overage_count: 125,
                                    free_credits_remaining: 0,
                                    discounted_credits_remaining: 0,
                                    stripe_customer_id: 'cus_456',
                                    stripe_subscription_id: 'sub_456',
                                },
                                error: null,
                            })),
                        })),
                    })),
                } as any;
            }
            return { select: vi.fn() } as any;
        });

        const formData = new FormData();
        const fakeFile = new File([VALID_JPEG_BYTES], 'scene.jpg', { type: 'image/jpeg' });
        fakeFile.arrayBuffer = async () => VALID_JPEG_BYTES.slice().buffer;
        formData.append('image', fakeFile);
        formData.append('styleId', '327247e9-8b3e-4b4c-857b-59dcffe4b83b');
        formData.append('style', 'Rainier - TM - Round Top');

        const result = await generateDesign(formData);
        expect(result.success).toBe(true);

        expect(mockProfileUpdate).toHaveBeenCalledTimes(1);
        const updateArgs = (mockProfileUpdate.mock.calls as any)[0][0];
        // $100.00 + $0.80 = $100.80 (must NOT reset to 0 when crossing threshold)
        expect(updateArgs.pending_overage_balance).toBe(100.80);
        expect(updateArgs.current_overage_count).toBe(126);
    });
});
