import fs from 'fs';
import path from 'path';
import os from 'os';

export function ensureGoogleCredentials() {
    // If GOOGLE_APPLICATION_CREDENTIALS is already a valid file path, do nothing.
    const envCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (envCreds && !envCreds.trim().startsWith('{') && fs.existsSync(envCreds)) {
        return envCreds;
    }

    if (envCreds) {
        try {
            // It's likely the Base64 or JSON content directly
            const isBase64 = !envCreds.trim().startsWith('{');
            const jsonContent = isBase64
                ? Buffer.from(envCreds, 'base64').toString('utf-8')
                : envCreds;

            // Verify it parses
            JSON.parse(jsonContent);

            const tmpDir = os.tmpdir();
            const filePath = path.join(tmpDir, 'google-credentials.json');
            fs.writeFileSync(filePath, jsonContent);

            // Set the env var so the Google Libs pick it up
            process.env.GOOGLE_APPLICATION_CREDENTIALS = filePath;
            console.log(`[AUTH] Credentials written to ${filePath}`);
            return filePath;
        } catch (e) {
            console.error('[AUTH] Failed to process credentials env var', e);
        }
    }
    return null;
}
