const fs = require('fs');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');

async function getAccessToken() {
    const envPath = path.resolve(__dirname, '../.env.local');
    // Default fallback
    let projectId = 'railvision-480923';
    let googleAuthOptions = {};

    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                if (key.trim() === 'VERTEX_PROJECT_ID') projectId = value.trim();
                if (key.trim() === 'GOOGLE_APPLICATION_CREDENTIALS') {
                    try {
                        const credsStr = value.trim();
                        // simplistic detection of base64 vs json
                        const isBase64 = !credsStr.startsWith('{');
                        const jsonStr = isBase64 ? Buffer.from(credsStr, 'base64').toString('utf-8') : credsStr;
                        googleAuthOptions = { credentials: JSON.parse(jsonStr) };
                    } catch (e) {
                        console.error("Failed to parse local creds:", e.message);
                    }
                }
            }
        });
    }

    // Force global endpoint auth
    const auth = new GoogleAuth({
        scopes: 'https://www.googleapis.com/auth/cloud-platform',
        ...googleAuthOptions
    });

    // Explicit project ID usage
    if (googleAuthOptions.credentials?.project_id) {
        projectId = googleAuthOptions.credentials.project_id;
    }

    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return { token: token.token, projectId };
}

async function runBenchmark() {
    console.log("=== BENCHMARK: GEMINI 3 SPEED TEST ===");
    try {
        const { token, projectId } = await getAccessToken();
        const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/gemini-3-pro-image-preview:generateContent`;
        console.log(`Target: ${url}`);

        async function testPrompt(name, instructions) {
            console.log(`\n--- TESTING: ${name} ---`);
            const start = Date.now();

            const prompt = `Describe a blue ball. ${instructions}`;

            try {
                const fetch = (await import('node-fetch')).default;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.4,
                            maxOutputTokens: 2048
                        }
                    })
                });

                if (!res.ok) {
                    const txt = await res.text();
                    throw new Error(`${res.status} ${res.statusText}: ${txt.substring(0, 100)}`);
                }

                const data = await res.json();

                const duration = (Date.now() - start) / 1000;

                // Check for thought/image
                let hasThought = false;
                if (data.candidates?.[0]?.content?.parts) {
                    hasThought = data.candidates[0].content.parts.some(p => p.thought);
                }

                console.log(`Duration: ${duration.toFixed(2)}s`);
                console.log(`Has 'thought' part in response: ${hasThought}`);

            } catch (e) {
                console.log(`Error: ${e.message}`);
            }
        }

        // 1. Baseline
        await testPrompt("Baseline", "");

        // 2. Direct Instruction
        await testPrompt("Direct Instruction", " CRITICAL: Skip reasoning. Do not output thoughts. Generate result IMMEDIATELY.");

    } catch (e) {
        console.error("Benchmark/Auth failed", e);
    }
}

runBenchmark();
