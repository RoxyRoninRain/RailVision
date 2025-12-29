const { VertexAI } = require('@google-cloud/vertexai');
const fs = require('fs');
const path = require('path');

async function checkModels() {
    console.log("=== DIAGNOSTIC: Checking Vertex AI Models ===");

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
            console.log("✅ Credentials Found & Parsed");
        } catch (e) {
            console.log("❌ Credentials Parse Failed:", e.message);
        }
    } else {
        console.log("⚠️ No GOOGLE_APPLICATION_CREDENTIALS found in .env.local");
    }

    // 2. Helper to List Models
    async function listModels(location) {
        console.log(`\n--- Checking Location: ${location} ---`);
        try {
            const client = new VertexAI({
                project: projectId,
                location: location,
                googleAuthOptions
            });

            // Note: VertexAI SDK doesn't expose listModels cleanly directly on the instance sometimes,
            // we have to use the GAPIC client if needed, but let's try to infer availability by instantiation
            // or use a known model check.

            // Actually, the best way to check if a model exists is to try to get it and run a dummy prompt.
            // Listing requires a different client (ModelServiceClient).

            const modelsToTest = [
                'gemini-3-pro-image-preview',
                'gemini-3.0-pro-image-preview',
                'gemini-1.5-pro-preview-0514',
                'gemini-1.5-flash-001'
            ];

            for (const m of modelsToTest) {
                process.stdout.write(`Testing ${m}... `);
                try {
                    const model = client.getGenerativeModel({ model: m });
                    // Fast dummy generation
                    const res = await model.generateContent({
                        contents: [{ role: 'user', parts: [{ text: 'hi' }] }]
                    });
                    console.log("✅ AVAILABLE");
                } catch (e) {
                    if (e.message.includes('404') || e.message.includes('not found')) {
                        console.log("❌ NOT FOUND");
                    } else if (e.message.includes('403') || e.message.includes('permission')) {
                        console.log("⛔ PERMISSION DENIED");
                    } else if (e.message.includes('timeout') || e.message.includes('deadline')) {
                        console.log("⏳ TIMEOUT");
                    } else {
                        console.log(`⚠️ ERROR: ${e.message.split('\n')[0]}`);
                    }
                }
            }

        } catch (e) {
            console.error(`Client Init Error for ${location}:`, e.message);
        }
    }

    await listModels('us-central1');
    await listModels('global');

    console.log("\n=== END DIAGNOSTIC ===");
}

checkModels();
