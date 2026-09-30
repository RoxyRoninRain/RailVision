import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCheckIsAdmin = vi.fn();
const mockUpdateUserById = vi.fn();
const mockGenerateLink = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockProfileSelect = vi.fn();
const mockProfileUpdate = vi.fn();

vi.mock('@/lib/auth-utils', () => ({
    checkIsAdmin: () => mockCheckIsAdmin(),
}));

vi.mock('next/headers', () => ({
    headers: vi.fn(async () => new Map([
        ['x-forwarded-host', 'app.railify.com'],
        ['x-forwarded-proto', 'https'],
    ])),
}));

vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: vi.fn(() => ({
        auth: {
            admin: {
                updateUserById: mockUpdateUserById,
                generateLink: mockGenerateLink,
            },
            resetPasswordForEmail: mockResetPasswordForEmail,
        },
        from: vi.fn((table: string) => {
            if (table === 'profiles') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: mockProfileSelect,
                        })),
                    })),
                    update: vi.fn((data: any) => ({
                        eq: mockProfileUpdate.mockReturnValue({ error: null }),
                    })),
                };
            }
            return {};
        }),
    })),
}));

describe('Tenant Credentials & Password Reset Admin Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckIsAdmin.mockResolvedValue(true);
        mockProfileSelect.mockResolvedValue({
            data: {
                id: 'tenant-abc-123',
                email: 'current@tenant.com',
                shop_name: 'Original Shop',
            },
            error: null,
        });
        mockUpdateUserById.mockResolvedValue({ data: {}, error: null });
        mockResetPasswordForEmail.mockResolvedValue({ error: null });
        mockGenerateLink.mockResolvedValue({
            data: { properties: { action_link: 'https://app.railify.com/auth/callback?code=mock-code' } },
            error: null,
        });
    });

    it('rejects updateTenantCredentials if caller is not an admin', async () => {
        mockCheckIsAdmin.mockResolvedValue(false);
        const { updateTenantCredentials } = await import('@/app/admin/actions');
        const res = await updateTenantCredentials('tenant-abc-123', { email: 'new@tenant.com' });
        expect(res).toEqual({ error: 'Unauthorized' });
    });

    it('updates both auth.users and public.profiles when changing email and shop name', async () => {
        const { updateTenantCredentials } = await import('@/app/admin/actions');
        const res = await updateTenantCredentials('tenant-abc-123', {
            email: 'newemail@tenant.com',
            shopName: 'New Shop Name',
            phone: '555-987-6543',
        });

        expect(res.success).toBe(true);
        expect(mockUpdateUserById).toHaveBeenCalledWith('tenant-abc-123', {
            email: 'newemail@tenant.com',
            email_confirm: true,
            user_metadata: {
                full_name: 'New Shop Name',
            },
        });
        expect(mockProfileUpdate).toHaveBeenCalled();
    });

    it('rejects sendTenantPasswordReset if caller is not an admin', async () => {
        mockCheckIsAdmin.mockResolvedValue(false);
        const { sendTenantPasswordReset } = await import('@/app/admin/actions');
        const res = await sendTenantPasswordReset('tenant-abc-123');
        expect(res).toEqual({ error: 'Unauthorized' });
    });

    it('sends reset email and returns directLink on sendTenantPasswordReset', async () => {
        const { sendTenantPasswordReset } = await import('@/app/admin/actions');
        const res = await sendTenantPasswordReset('tenant-abc-123');

        expect(res.success).toBe(true);
        expect(res.email).toBe('current@tenant.com');
        expect(res.directLink).toBe('https://app.railify.com/auth/callback?code=mock-code');
        expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
            'current@tenant.com',
            expect.objectContaining({
                redirectTo: 'https://app.railify.com/auth/callback?next=/reset-password',
            })
        );
    });
});
