import { detectImageMetadata } from '@/lib/validations';

export class InputSanitizer {
    static readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    static readonly MAX_SIZE_MB = 10;
    static readonly MAX_SIZE_BYTES = 10 * 1024 * 1024;

    static validate(file: File): { valid: boolean; error?: string } {
        if (!file) {
            return { valid: false, error: 'No file selected.' };
        }

        if (!this.ALLOWED_TYPES.includes(file.type)) {
            return { valid: false, error: 'Invalid file type. Only JPG, PNG, and WebP images are allowed.' };
        }

        if (file.size > this.MAX_SIZE_BYTES) {
            return { valid: false, error: `File size exceeds ${this.MAX_SIZE_MB}MB limit.` };
        }

        return { valid: true };
    }

    static validateType(file: File): { valid: boolean; error?: string } {
        if (!file) {
            return { valid: false, error: 'No file selected.' };
        }
        if (!this.ALLOWED_TYPES.includes(file.type)) {
            return { valid: false, error: 'Invalid file type. Only JPG, PNG, and WebP images are allowed.' };
        }
        return { valid: true };
    }

    /**
     * Verifies binary magic bytes of an uploaded image buffer on the server so forged
     * `Content-Type` headers (e.g. HTML/SVG disguised as `image/jpeg`) are rejected.
     */
    static validateBuffer(buffer: Buffer | Uint8Array): {
        valid: boolean;
        mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
        ext?: 'jpg' | 'png' | 'webp';
        error?: string;
    } {
        if (!buffer || buffer.byteLength === 0) {
            return { valid: false, error: 'Empty image file.' };
        }
        if (buffer.byteLength > this.MAX_SIZE_BYTES) {
            return { valid: false, error: `File size exceeds ${this.MAX_SIZE_MB}MB limit.` };
        }
        const meta = detectImageMetadata(buffer);
        if (!meta.valid || !meta.mimeType || meta.mimeType === 'image/heic') {
            return {
                valid: false,
                error: 'Invalid or corrupted image file. Only genuine JPG, PNG, and WebP images are allowed.',
            };
        }
        return {
            valid: true,
            mimeType: meta.mimeType,
            ext: meta.ext as 'jpg' | 'png' | 'webp',
        };
    }
}
