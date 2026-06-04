const { GoogleAuth } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

async function getAccessToken() {
    const creds = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'service-account.json'), 'utf8'));
    const projectId = creds.project_id;

    const auth = new GoogleAuth({
        scopes: 'https://www.googleapis.com/auth/cloud-platform',
        credentials: creds
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return { token: token.token, projectId };
}

async function probeModel(modelId, token, projectId) {
    const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${modelId}:generateContent`;
    console.log(`Testing: ${modelId}...`);
    try {
        const fetch = (await import('node-fetch')).default;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 10
                }
            })
        });

        if (res.ok) {
            console.log(`✅ SUCCESS: ${modelId} is available!`);
            return true;
        } else {
            const txt = await res.text();
            console.log(`❌ FAILED: ${modelId} (${res.status})`);
            return false;
        }
    } catch (e) {
        console.log(`❌ ERROR: ${modelId} - ${e.message}`);
        return false;
    }
}

async function run() {
    const { token, projectId } = await getAccessToken();
    const suspects = [
        'gemini-3-flash-image-preview',
        'gemini-3.0-flash-image-preview',
        'gemini-3-flash-preview',
        'gemini-3.0-flash-preview',
        'gemini-3-flash',
        'gemini-3.0-flash'
    ];

    for (const id of suspects) {
        await probeModel(id, token, projectId);
    }
}

run();
