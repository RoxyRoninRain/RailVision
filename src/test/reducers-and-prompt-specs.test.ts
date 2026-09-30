import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerateDesignWithNanoBanana = vi.fn();
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
}));

vi.mock('@/app/admin/actions', () => ({
    getActiveSystemPrompt: vi.fn(async () => ({
        key: 'gemini-handrail-main',
        system_instruction: 'Standard system instruction',
        user_template: 'Input Scene: {{image}}\nStyle Target: {{style}}',
        negative_prompt: 'watermark, blurry'
    })),
}));

const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({
    eq: vi.fn(() => ({
        single: mockSingle,
    })),
}));

const mockFrom = vi.fn((table: string) => {
    if (table === 'profiles') {
        return {
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn(async () => ({
                        data: {
                            id: 'tenant-123',
                            subscription_status: 'active',
                            current_usage: 5,
                            tier_name: 'Showroom',
                            enable_overdrive: true,
                            stripe_customer_id: 'cus_123',
                            stripe_subscription_id: 'sub_123',
                        },
                        error: null,
                    })),
                })),
            })),
            update: vi.fn(() => ({
                eq: vi.fn(async () => ({ error: null })),
            })),
        };
    }
    if (table === 'portfolio') {
        return {
            select: mockSelect,
        };
    }
    if (table === 'generations') {
        return {
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    gte: vi.fn(async () => ({ count: 0, error: null })),
                })),
            })),
            insert: vi.fn(async () => ({ error: null })),
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
                data: { user: { id: 'admin-001', email: 'admin@railify.app' } },
                error: null,
            })),
        },
    })),
}));

describe('Reducer Toggle and Prompt Specification Delivery', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckIsAdmin.mockResolvedValue(true);
        mockGenerateDesignWithNanoBanana.mockResolvedValue({
            success: true,
            image: 'data:image/png;base64,mockoutput',
        });
        global.fetch = vi.fn(async () => ({
            ok: true,
            arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        } as any));
    });

    it('passes hasReducers: false, description, and customPromptNote to NanoBanana', async () => {
        mockSingle.mockResolvedValue({
            data: {
                id: '550e8400-e29b-41d4-a716-446655440001',
                image_url: 'https://example.com/style.jpg',
                reference_images: [],
                has_bottom_rail: false,
                has_reducers: false,
                description: 'Square posts with round top rail, flush direct weld.',
            },
            error: null,
        });

        const { generateDesign } = await import('@/app/actions/ai');

        const formData = new FormData();
        const fakeImage = new File(['fake-canvas-bytes'], 'staircase.jpg', { type: 'image/jpeg' });
        fakeImage.arrayBuffer = async () => new Uint8Array([1, 2, 3, 4]).buffer;
        formData.append('image', fakeImage);
        formData.append('styleId', '550e8400-e29b-41d4-a716-446655440001');
        formData.append('style', 'Square Posts Round Rail');
        formData.append('is_admin_test', 'true');
        formData.append('organization_id', '550e8400-e29b-41d4-a716-446655440002');
        formData.append('prompt', 'Ensure square post connects flush to round rail with NO reducers');

        const result = await generateDesign(formData);
        expect(result.success).toBe(true);
        expect(mockGenerateDesignWithNanoBanana).toHaveBeenCalledTimes(1);

        const [, styleInputPassed] = mockGenerateDesignWithNanoBanana.mock.calls[0];
        expect(styleInputPassed.technicalSpecs).toBeDefined();
        expect(styleInputPassed.technicalSpecs.hasReducers).toBe(false);
        expect(styleInputPassed.technicalSpecs.hasBottomRail).toBe(false);
        expect(styleInputPassed.technicalSpecs.description).toContain('Square posts with round top rail');
        expect(styleInputPassed.technicalSpecs.customNote).toBe('Ensure square post connects flush to round rail with NO reducers');
    });

    it('allows overriding has_reducers to true via FormData', async () => {
        mockSingle.mockResolvedValue({
            data: {
                id: '550e8400-e29b-41d4-a716-446655440001',
                image_url: 'https://example.com/style.jpg',
                reference_images: [],
                has_bottom_rail: false,
                has_reducers: false, // Default is false in DB
                description: 'Square posts with round rail',
            },
            error: null,
        });

        const { generateDesign } = await import('@/app/actions/ai');

        const formData = new FormData();
        const fakeImage = new File(['fake-canvas-bytes'], 'staircase.jpg', { type: 'image/jpeg' });
        fakeImage.arrayBuffer = async () => new Uint8Array([1, 2, 3, 4]).buffer;
        formData.append('image', fakeImage);
        formData.append('styleId', '550e8400-e29b-41d4-a716-446655440001');
        formData.append('style', 'Square Posts Round Rail');
        formData.append('is_admin_test', 'true');
        formData.append('organization_id', '550e8400-e29b-41d4-a716-446655440002');
        formData.append('has_reducers', 'true'); // Explicit override to true

        const result = await generateDesign(formData);

        expect(result.success).toBe(true);
        const [, styleInputPassed] = mockGenerateDesignWithNanoBanana.mock.calls[0];
        expect(styleInputPassed.technicalSpecs.hasReducers).toBe(true);
    });
});
