import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/lib/auth-context', () => ({
    getActingUser: vi.fn(async () => ({
        user: { id: 'user-123' },
        tenantId: 'tenant-123',
        supabase: {
            from: (table: string) => {
                if (table === 'portfolio') {
                    return {
                        select: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                order: vi.fn(() => ({
                                    limit: vi.fn(() => ({
                                        single: vi.fn().mockResolvedValue({ data: { display_order: 1 } })
                                    }))
                                })),
                                single: vi.fn().mockResolvedValue({ data: { style_metadata: {} } })
                            }))
                        })),
                        insert: mockInsert,
                        update: mockUpdate,
                    };
                }
                return {};
            },
            storage: {
                from: () => ({
                    getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/img.jpg' } }),
                    upload: vi.fn().mockResolvedValue({ error: null })
                })
            }
        },
        isAdmin: false,
        isImpersonating: false
    }))
}));

vi.mock('@/lib/auth-utils', () => ({
    checkIsAdmin: vi.fn().mockResolvedValue(false)
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn()
}));

vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: vi.fn()
}));

describe('Portfolio post_mount schema fallback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('falls back to style_metadata when createStyle encounters missing post_mount column', async () => {
        const { createStyle } = await import('@/app/actions/portfolio');

        // First insert call fails with schema cache error
        // Second insert call (retry without post_mount column) succeeds
        mockInsert
            .mockImplementationOnce(() => ({
                select: () => ({
                    single: vi.fn().mockResolvedValue({
                        data: null,
                        error: { message: "Could not find the 'post_mount' column of 'portfolio' in the schema cache" }
                    })
                })
            }))
            .mockImplementationOnce((payload: any) => ({
                select: () => ({
                    single: vi.fn().mockResolvedValue({
                        data: { id: 'new-style-id', ...payload },
                        error: null
                    })
                })
            }));

        const formData = new FormData();
        formData.append('name', 'Modern Rail');
        formData.append('description', 'Test Rail');
        formData.append('image_url', 'https://example.com/img.jpg');
        formData.append('post_mount', 'side');

        const result = await createStyle(formData);

        expect(result.success).toBe(true);
        expect(mockInsert).toHaveBeenCalledTimes(2);

        // First attempt had post_mount column
        expect(mockInsert.mock.calls[0][0].post_mount).toBe('side');

        // Second retry deleted post_mount column and saved inside style_metadata
        const retryPayload = mockInsert.mock.calls[1][0];
        expect(retryPayload.post_mount).toBeUndefined();
        expect(retryPayload.style_metadata.post_mount).toBe('side');
    });

    it('falls back to style_metadata when updateStyle encounters missing post_mount column', async () => {
        const { updateStyle } = await import('@/app/actions/portfolio');

        const mockEqTenant = vi.fn();
        mockUpdate
            .mockImplementationOnce(() => ({
                eq: vi.fn(() => ({
                    eq: vi.fn().mockResolvedValue({
                        error: { message: "Could not find the 'post_mount' column of 'portfolio' in the schema cache" }
                    })
                }))
            }))
            .mockImplementationOnce((payload: any) => ({
                eq: vi.fn(() => ({
                    eq: vi.fn().mockResolvedValue({
                        error: null
                    })
                }))
            }));

        const formData = new FormData();
        formData.append('id', 'style-456');
        formData.append('post_mount', 'side');

        const result = await updateStyle(formData);

        expect(result.success).toBe(true);
        expect(mockUpdate).toHaveBeenCalledTimes(2);

        // First attempt included updates.post_mount
        expect(mockUpdate.mock.calls[0][0].post_mount).toBe('side');

        // Second retry removed updates.post_mount and kept it in style_metadata
        const retryUpdates = mockUpdate.mock.calls[1][0];
        expect(retryUpdates.post_mount).toBeUndefined();
        expect(retryUpdates.style_metadata.post_mount).toBe('side');
    });
});
