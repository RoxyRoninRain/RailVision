import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isSafeExternalUrl, isTrustedAppHost } from '@/lib/validations';
import { resetRateLimitBuckets } from '@/lib/rate-limit';

const VALID_JPEG_BYTES = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]);

const mockCheckIsAdmin = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/auth-utils', () => ({
    checkIsAdmin: (...args: any[]) => mockCheckIsAdmin(...args),
    ADMIN_EMAILS: ['admin@railify.com', 'me@railify.com', 'john@railify.com', 'mississippi_metal_magic@gmail.com', 'missmetalmagic@gmail.com'],
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: {
            getUser: mockGetUser,
        },
    })),
}));

vi.mock('@/lib/auth-context', () => ({
    getActingUser: vi.fn(async () => ({
        user: { id: 'tenant-1', email: 'tenant@example.com' },
        tenantId: 'tenant-1',
        supabase: {},
        isImpersonating: false,
        isAdmin: false,
    })),
}));

vi.mock('@/lib/vertex', () => ({
    generateDesignWithNanoBanana: vi.fn(),
    getVertexClient: vi.fn(),
    getRouterModel: vi.fn(),
}));

describe('Security Hardening Regression Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetRateLimitBuckets();
    });

    describe('SSRF Protection (isSafeExternalUrl)', () => {
        it('allows valid public HTTPS URLs', () => {
            expect(isSafeExternalUrl('https://example.com/image.jpg')).toBe(true);
            expect(isSafeExternalUrl('https://zlwcdhgdmshtmkqngfzg.supabase.co/storage/v1/object/public/portfolio/test.png')).toBe(true);
        });

        it('blocks cloud metadata, loopback, and private RFC1918 addresses', () => {
            expect(isSafeExternalUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
            expect(isSafeExternalUrl('http://metadata.google.internal/computeMetadata/v1/')).toBe(false);
            expect(isSafeExternalUrl('http://localhost:3000/api')).toBe(false);
            expect(isSafeExternalUrl('http://127.0.0.1:5432/')).toBe(false);
            expect(isSafeExternalUrl('http://0.0.0.0/')).toBe(false);
            expect(isSafeExternalUrl('http://10.0.0.1/internal')).toBe(false);
            expect(isSafeExternalUrl('http://172.16.0.1/internal')).toBe(false);
            expect(isSafeExternalUrl('http://192.168.1.1/admin')).toBe(false);
            expect(isSafeExternalUrl('http://[::1]:8080/')).toBe(false);
        });

        it('blocks non-HTTP protocols', () => {
            expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
            expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
            expect(isSafeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
        });
    });

    describe('Host Header Validation (isTrustedAppHost)', () => {
        it('allows official Railify domains and localhost in non-production', () => {
            expect(isTrustedAppHost('railify.app')).toBe(true);
            expect(isTrustedAppHost('app.railify.com')).toBe(true);
            expect(isTrustedAppHost('localhost:3000')).toBe(true);
        });

        it('blocks untrusted domains and path-injected hosts', () => {
            expect(isTrustedAppHost('evil.com')).toBe(false);
            expect(isTrustedAppHost('railify.app.evil.com')).toBe(false);
            expect(isTrustedAppHost('railify.app/evil')).toBe(false);
            expect(isTrustedAppHost('railify.app@evil.com')).toBe(false);
        });
    });

    describe('Admin Authorization Enforcement', () => {
        it('blocks non-admin users from runBulkTest', async () => {
            mockCheckIsAdmin.mockResolvedValue(false);
            const { runBulkTest } = await import('@/app/admin/tools/bulk-test/actions');
            const fd = new FormData();
            const res = await runBulkTest(fd);
            expect(res.error).toContain('Unauthorized');
        });

        it('blocks non-admin users from generateExperimentalDesign', async () => {
            mockCheckIsAdmin.mockResolvedValue(false);
            const { generateExperimentalDesign } = await import('@/app/actions/experimental');
            const fd = new FormData();
            const res = await generateExperimentalDesign(fd);
            expect(res.error).toContain('Unauthorized');
        });
    });

    describe('Path Traversal & SSRF Prevention in Actions', () => {
        it('rejects path traversal in generateDesign style_url', async () => {
            const { generateDesign } = await import('@/app/actions/ai');
            const fd = new FormData();
            fd.set('image', new File([VALID_JPEG_BYTES], 'stairs.jpg', { type: 'image/jpeg' }));
            fd.set('style', 'Modern');
            fd.set('style_url', '/../../.env.local');

            const res = await generateDesign(fd);
            expect(res.error).toContain('Unsafe style_url path');
        });

        it('rejects SSRF URL in generateDesign style_url', async () => {
            const { generateDesign } = await import('@/app/actions/ai');
            const fd = new FormData();
            fd.set('image', new File([VALID_JPEG_BYTES], 'stairs.jpg', { type: 'image/jpeg' }));
            fd.set('style', 'Modern');
            fd.set('style_url', 'http://169.254.169.254/latest/meta-data/');

            const res = await generateDesign(fd);
            expect(res.error).toContain('Invalid Request');
        });

        it('rejects SSRF URL in portfolio createStyle image_url', async () => {
            const { createStyle } = await import('@/app/actions/portfolio');
            const fd = new FormData();
            fd.set('name', 'Malicious Style');
            fd.set('image_url', 'http://127.0.0.1:8080/internal-secret.png');

            const res = await createStyle(fd);
            expect(res.error).toContain('Invalid or unsafe main image URL');
        });
    });
});
