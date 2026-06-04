const fs = require('fs');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');

(async () => {
    // Read .env.local manually
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');

    // Parse env file specifically for GOOGLE_APPLICATION_CREDENTIALS
    const match = envContent.match(/GOOGLE_APPLICATION_CREDENTIALS=(.*)/);
    if (!match) {
        console.error('GOOGLE_APPLICATION_CREDENTIALS not found in .env.local');
        process.exit(1);
    }

    let credsStr = match[1];
    // Strip quotes if present
    if (credsStr.startsWith('"') && credsStr.endsWith('"')) {
        credsStr = credsStr.slice(1, -1);
    }

    try {
        const isBase64 = !credsStr.trim().startsWith('{');
        console.log('Is Base64?', isBase64);

        const jsonStr = isBase64 ? Buffer.from(credsStr, 'base64').toString('utf-8') : credsStr;
        const creds = JSON.parse(jsonStr);

        console.log('--- Creds Parsed ---');
        console.log('Project ID:', creds.project_id);
        console.log('Client Email:', creds.client_email);

        let privateKey = creds.private_key;
        console.log('--- Private Key Raw Check ---');
        console.log('Contains \\n literal?', privateKey.includes('\\n'));
        console.log('Contains actual newline?', privateKey.includes('\n'));

        const variants = [
            { name: 'Original (Real Newlines)', key: privateKey },
            { name: 'No CR', key: privateKey.replace(/\r/g, '') },
            { name: 'Literal \\n (Double Escaped)', key: privateKey.replace(/\n/g, '\\n') },
            // Reconstruct PEM
            {
                name: 'Reconstructed PEM', key: (() => {
                    const body = privateKey.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, '');
                    const chunks = body.match(/.{1,64}/g).join('\n');
                    return `-----BEGIN PRIVATE KEY-----\n${chunks}\n-----END PRIVATE KEY-----\n`;
                })()
            }
        ];

        for (const v of variants) {
            console.log(`\n=== TESTING VARIANT: ${v.name} ===`);
            try {
                const auth = new GoogleAuth({
                    credentials: {
                        client_email: creds.client_email,
                        private_key: v.key,
                    },
                    scopes: 'https://www.googleapis.com/auth/cloud-platform'
                });

                const client = await auth.getClient();
                const token = await client.getAccessToken();
                console.log('SUCCESS! Token:', token.token?.substring(0, 10));
                // Found a working one
            } catch (err) {
                console.log(`FAILED (${v.name}):`, err.code || err.message);
            }
        }

    } catch (e) {
        console.error('Parsing/Logic Error:', e);
    }
})();
