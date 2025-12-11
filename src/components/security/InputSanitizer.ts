export class InputSanitizer {
    static readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
    static readonly MAX_SIZE_MB = 5;
    static readonly MAX_SIZE_BYTES = 5 * 1024 * 1024;

    static validate(file: File): { valid: boolean; error?: string } {
        if (!file) {
            return { valid: false, error: 'No file selected.' };
        }

        if (!this.ALLOWED_TYPES.includes(file.type)) {
            return { valid: false, error: 'Invalid file type. Only JPG and PNG are allowed.' };
        }

        if (file.size > this.MAX_SIZE_BYTES) {
            return { valid: false, error: `File size exceeds ${this.MAX_SIZE_MB}MB limit.` };
        }

        return { valid: true };
    }
}
