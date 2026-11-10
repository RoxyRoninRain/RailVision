import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export function ensureGoogleCredentials() {
    // If GOOGLE_APPLICATION_CREDENTIALS is already a valid file path, do nothing.
    const envCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (envCreds && !envCreds.trim().startsWith('{') && fs.existsSync(envCreds)) {
        return envCreds;
    }

    if (envCreds) {
        try {
            const isBase64 = !envCreds.trim().startsWith('{');
            const jsonContent = isBase64
                ? Buffer.from(envCreds, 'base64').toString('utf-8')
                : envCreds;

            // Verify it parses cleanly as JSON
            JSON.parse(jsonContent);

            // Use a non-predictable process-scoped filename in os.tmpdir() with mode 0600
            const suffix = crypto.createHash('sha256').update(`${process.pid}:${jsonContent.slice(0, 64)}`).digest('hex').slice(0, 16);
            const filePath = path.join(os.tmpdir(), `.gcp-creds-${suffix}.json`);
            fs.writeFileSync(filePath, jsonContent, { mode: 0o600 });

            process.env.GOOGLE_APPLICATION_CREDENTIALS = filePath;
            return filePath;
        } catch (e) {
            console.error('[AUTH] Failed to process credentials env var', e);
        }
    }
    return null;
}
