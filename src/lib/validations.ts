import { z } from 'zod';

/**
 * Unforgeable runtime token used by internal server callers (e.g. `ai.ts`) to access
 * system prompts without exposing `'use server'` prompt fetchers to external HTTP clients.
 */
export const INTERNAL_PROMPT_TOKEN = Symbol('railify.internal.prompt_access');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string | null | undefined): value is string {
    if (!value || typeof value !== 'string') return false;
    return UUID_REGEX.test(value.trim());
}

function isPrivateIpv4Octets(a: number, b: number): boolean {
    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127) ||
        a >= 224
    );
}

/**
 * Validates that an external URL uses HTTPS (or HTTP in local dev) and does not
 * resolve to loopback, link-local, cloud metadata, or private RFC1918 IP ranges.
 */
export function isSafeExternalUrl(urlStr: string): boolean {
    try {
        const parsed = new URL(urlStr);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            return false;
        }
        if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
            return false;
        }
        if (parsed.username || parsed.password) {
            return false;
        }

        const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
        if (
            !host ||
            host === 'localhost' ||
            host === '0.0.0.0' ||
            host === '::' ||
            host === '::1' ||
            host === '0:0:0:0:0:0:0:1' ||
            host === '0:0:0:0:0:0:0:0' ||
            host === 'metadata.google.internal' ||
            host === 'metadata' ||
            host.endsWith('.internal') ||
            host.endsWith('.local') ||
            host.endsWith('.localhost')
        ) {
            return false;
        }

        // Reject single-integer or hex/octal numeric hostnames (e.g. http://2130706433 or http://0x7f000001)
        if (/^(0x[0-9a-f]+|\d+)$/i.test(host)) {
            return false;
        }

        // Block IPv4 loopback, private, CGNAT, multicast, and link-local ranges
        const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
        if (ipv4Match) {
            const octets = ipv4Match.slice(1).map(Number);
            if (octets.some((o) => o < 0 || o > 255)) return false;
            if (isPrivateIpv4Octets(octets[0], octets[1])) {
                return false;
            }
        }

        // Block IPv6 private, link-local, and IPv4-mapped ranges (both dotted and WHATWG hex forms like ::ffff:7f00:1)
        if (host.includes(':')) {
            if (
                host.startsWith('fc') ||
                host.startsWith('fd') ||
                host.startsWith('fe8') ||
                host.startsWith('fe9') ||
                host.startsWith('fea') ||
                host.startsWith('feb') ||
                host.startsWith('::ffff:') ||
                host.startsWith('0:0:0:0:0:ffff:')
            ) {
                return false;
            }
        }

        return true;
    } catch {
        return false;
    }
}

export type SupportedAspectRatio =
    | '1:1'
    | '2:3'
    | '3:2'
    | '3:4'
    | '4:3'
    | '4:5'
    | '5:4'
    | '9:16'
    | '16:9'
    | '21:9';

const GEMINI_ASPECT_RATIOS: Array<{ label: SupportedAspectRatio; ratio: number }> = [
    { label: '1:1', ratio: 1 / 1 },
    { label: '2:3', ratio: 2 / 3 },
    { label: '3:2', ratio: 3 / 2 },
    { label: '3:4', ratio: 3 / 4 },
    { label: '4:3', ratio: 4 / 3 },
    { label: '4:5', ratio: 4 / 5 },
    { label: '5:4', ratio: 5 / 4 },
    { label: '9:16', ratio: 9 / 16 },
    { label: '16:9', ratio: 16 / 9 },
    { label: '21:9', ratio: 21 / 9 },
];

/**
 * Maps pixel dimensions to the closest Gemini native `imageConfig.aspectRatio` value
 * so generated staircase renders preserve the input camera framing without cropping or stretching.
 */
export function getClosestSupportedAspectRatio(width?: number, height?: number): SupportedAspectRatio | undefined {
    if (!width || !height || width <= 0 || height <= 0) return undefined;
    const actual = width / height;
    let best = GEMINI_ASPECT_RATIOS[0];
    let smallestDiff = Math.abs(Math.log(actual / best.ratio));
    for (let i = 1; i < GEMINI_ASPECT_RATIOS.length; i++) {
        const candidate = GEMINI_ASPECT_RATIOS[i];
        const diff = Math.abs(Math.log(actual / candidate.ratio));
        if (diff < smallestDiff) {
            smallestDiff = diff;
            best = candidate;
        }
    }
    return best.label;
}

export interface DetectedImageMetadata {
    valid: boolean;
    mimeType?: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';
    ext?: 'jpg' | 'png' | 'webp' | 'heic';
    width?: number;
    height?: number;
    aspectRatio?: SupportedAspectRatio;
}

/**
 * Inspects binary magic bytes to verify genuine image content (defeating spoofed `File.type` headers)
 * and extracts pixel dimensions for JPEG, PNG, and WebP streams.
 */
export function detectImageMetadata(
    input: Buffer | Uint8Array,
    options?: { allowHeic?: boolean }
): DetectedImageMetadata {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes.length < 12) {
        return { valid: false };
    }

    // 1. PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
    ) {
        let width: number | undefined;
        let height: number | undefined;
        if (bytes.length >= 24) {
            const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            width = view.getUint32(16, false);
            height = view.getUint32(20, false);
        }
        return {
            valid: true,
            mimeType: 'image/png',
            ext: 'png',
            width,
            height,
            aspectRatio: getClosestSupportedAspectRatio(width, height),
        };
    }

    // 2. JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        let width: number | undefined;
        let height: number | undefined;
        let offset = 2;
        while (offset + 8 < bytes.length) {
            if (bytes[offset] !== 0xff) {
                offset++;
                continue;
            }
            const marker = bytes[offset + 1];
            // Skip padding 0xFF bytes
            if (marker === 0xff) {
                offset++;
                continue;
            }
            // Standalone markers without length
            if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
                offset += 2;
                continue;
            }
            if (offset + 3 >= bytes.length) break;
            const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
            if (segmentLength < 2) break;

            // SOF0..SOF15 (excluding DHT=0xC4, JPG=0xC8, DAC=0xCC)
            if (
                marker >= 0xc0 &&
                marker <= 0xcf &&
                marker !== 0xc4 &&
                marker !== 0xc8 &&
                marker !== 0xcc &&
                offset + 8 < bytes.length
            ) {
                height = (bytes[offset + 5] << 8) | bytes[offset + 6];
                width = (bytes[offset + 7] << 8) | bytes[offset + 8];
                break;
            }
            offset += 2 + segmentLength;
        }
        return {
            valid: true,
            mimeType: 'image/jpeg',
            ext: 'jpg',
            width,
            height,
            aspectRatio: getClosestSupportedAspectRatio(width, height),
        };
    }

    // 3. WEBP: "RIFF" .... "WEBP"
    if (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
    ) {
        let width: number | undefined;
        let height: number | undefined;
        if (bytes.length >= 30) {
            const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
            if (chunkType === 'VP8X') {
                width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
                height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
            } else if (chunkType === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
                width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
                height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
            } else if (chunkType === 'VP8L' && bytes[20] === 0x2f) {
                const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
                width = (bits & 0x3fff) + 1;
                height = ((bits >> 14) & 0x3fff) + 1;
            }
        }
        return {
            valid: true,
            mimeType: 'image/webp',
            ext: 'webp',
            width,
            height,
            aspectRatio: getClosestSupportedAspectRatio(width, height),
        };
    }

    // 4. Optional HEIC / HEIF / AVIF ISO BMFF container ("ftyp" at offset 4)
    if (
        options?.allowHeic &&
        bytes[4] === 0x66 &&
        bytes[5] === 0x74 &&
        bytes[6] === 0x79 &&
        bytes[7] === 0x70
    ) {
        const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
        if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'avif'].includes(brand)) {
            return {
                valid: true,
                mimeType: 'image/heic',
                ext: 'heic',
            };
        }
    }

    return { valid: false };
}

/**
 * Safely fetches an external image URL with SSRF protection (`isSafeExternalUrl`),
 * redirect blocking (`redirect: 'error'`), timeout enforcement, byte-size cap, and magic-byte check.
 */
export async function safeFetchImageBuffer(
    url: string,
    options?: { maxBytes?: number; timeoutMs?: number }
): Promise<Buffer | null> {
    if (!isSafeExternalUrl(url)) {
        return null;
    }

    const maxBytes = options?.maxBytes ?? 15 * 1024 * 1024;
    const timeoutMs = options?.timeoutMs ?? 12_000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            redirect: 'error',
            signal: controller.signal,
        });

        if (!res.ok) {
            return null;
        }

        const contentLengthHeader = res.headers?.get?.('content-length');
        if (contentLengthHeader) {
            const declaredBytes = Number(contentLengthHeader);
            if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
                return null;
            }
        }

        const arrBuf = await res.arrayBuffer();
        if (arrBuf.byteLength === 0 || arrBuf.byteLength > maxBytes) {
            return null;
        }

        const buf = Buffer.from(arrBuf);
        const meta = detectImageMetadata(buf);
        if (!meta.valid) {
            return null;
        }

        return buf;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Validates whether a Host / X-Forwarded-Host header belongs to our trusted application domains.
 */
export function isTrustedAppHost(host: string | null | undefined): boolean {
    if (!host) return false;
    const clean = host.trim().toLowerCase();
    if (/[/\\?#\s@]/.test(clean)) return false;

    if (process.env.NEXT_PUBLIC_APP_URL) {
        try {
            const configuredHost = new URL(process.env.NEXT_PUBLIC_APP_URL).host.toLowerCase();
            if (clean === configuredHost) return true;
        } catch {
            // ignore invalid env URL
        }
    }

    if (/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(clean)) {
        return process.env.NODE_ENV !== 'production';
    }

    return /^([a-z0-9-]+\.)*railify\.(app|com)(:\d{1,5})?$/.test(clean);
}

// Profile Update Schema
export const profileSchema = z.object({
    shop_name: z.string().min(1, "Shop name is required").optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    primary_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color hex").optional(),
    tool_background_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color hex").optional(),
    logo_size: z.number().min(10).max(500).optional(),
    logo_url: z.string().url().refine(isSafeExternalUrl, "Unsafe external URL").optional(),
    watermark_logo_url: z.string().url().refine(isSafeExternalUrl, "Unsafe external URL").optional(),
    website: z.string().optional(), // Was .url(), relaxed to prevent save blocking on bad input
    address_zip: z.string().optional(),
    confirmation_email_body: z.string().optional(),
    travel_settings: z.any().optional(), // Could be stricter if we knew shape
    enable_overdrive: z.boolean().optional(),
    max_monthly_spend: z.number().positive().optional().nullable(),
});

// Generation/AI Schema
export const generationSchema = z.object({
    style: z.string().min(1, "Style is required"),
    // Files are harder to validate directly with Zod on FormData without transform, 
    // but we can validate metadata identifiers
    styleId: z.string().uuid().optional(),
    style_url: z.string().url().refine(isSafeExternalUrl, "Unsafe external URL").optional(),
    organization_id: z.string().uuid().optional(),
});
