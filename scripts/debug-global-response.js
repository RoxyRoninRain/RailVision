const { VertexAI } = require('@google-cloud/vertexai');
const fs = require('fs');
const path = require('path');

async function debugGlobal() {
    console.log("=== DEBUGGING GLOBAL ENDPOINT RESPONSE ===");

    // 1. Env Setup
    const envPath = path.resolve(__dirname, '../.env.local');
    let envVars = {};
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) envVars[key.trim()] = value.trim();
        });
    }

    const projectId = envVars.VERTEX_PROJECT_ID || process.env.VERTEX_PROJECT_ID || 'railvision-480923';
    console.log(`Project ID: ${projectId}`);

    let googleAuthOptions = {};
    if (envVars.GOOGLE_APPLICATION_CREDENTIALS) {
        try {
            const credsStr = envVars.GOOGLE_APPLICATION_CREDENTIALS;
            const isBase64 = !credsStr.trim().startsWith('{');
            const jsonStr = isBase64 ? Buffer.from(credsStr, 'base64').toString('utf-8') : credsStr;
            const creds = JSON.parse(jsonStr);
            googleAuthOptions = { credentials: creds };
        } catch (e) {
            console.log("Creds error", e.message);
        }
    }

    // 2. Manual Fetch implementation to see raw body
    // The SDK hides the raw response usually. We will use the SDK to get the token, then raw fetch.

    try {
        const client = new VertexAI({
            project: projectId,
            location: 'global',
            googleAuthOptions
        });

        // We trigger an error by making a request
        const model = client.getGenerativeModel({ model: 'gemini-3-pro-image-preview' });

        console.log("Sending request via SDK (expecting failure)...");
        try {
            const res = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: 'hi' }] }]
            });
            console.log("Success?", res);
        } catch (sdkError) {
            console.log("SDK Error Message:", sdkError.message);
            // If the message mentions "Unexpected token <", we need to see the BODY.
            // Unfortunately SDK might not expose it easily in the error object properties if it crashed on JSON.parse.
            // But sometimes the error has 'response' property.
            if (sdkError.response) {
                console.log("Error Response Object:", sdkError.response);
            }
        }

        // 3. Raw REST call if SDK masks the HTML
        // Use GoogleAuth to get token
        const { GoogleAuth } = require('google-auth-library');
        const auth = new GoogleAuth({
            scopes: 'https://www.googleapis.com/auth/cloud-platform',
            ...googleAuthOptions
        });
        const clientAuth = await auth.getClient();
        const token = await clientAuth.getAccessToken();

        console.log("\n--- RAW HTTP REQUEST ---");
        const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/gemini-3-pro-image-preview:generateContent`;
        console.log(`URL: ${url}`);

        const fetch = (await import('node-fetch')).default;
        const rawRes = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: 'hi' }] }]
            })
        });

        console.log(`Status: ${rawRes.status} ${rawRes.statusText}`);
        const text = await rawRes.text(); // Get RAW text
        console.log("--- RAW BODY START ---");
        console.log(text.substring(0, 500)); // First 500 chars
        console.log("--- RAW BODY END ---");

    } catch (e) {
        console.error("Debug Fatal Error:", e);
    }
}

debugGlobal();
