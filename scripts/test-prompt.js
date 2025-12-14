const { VertexAI } = require('@google-cloud/vertexai');
const fs = require('fs');
const path = require('path');

// --- Helper: Robust Env Loader ---
function loadEnv() {
    const envPath = path.resolve(__dirname, '../.env.local');
    if (!fs.existsSync(envPath)) {
        console.warn('⚠️ .env.local not found');
        return {};
    }
    const content = fs.readFileSync(envPath, 'utf8');
    const vars = {};
    content.split('\n').forEach(line => {
        const firstEquals = line.indexOf('=');
        if (firstEquals === -1) return;
        const key = line.substring(0, firstEquals).trim();
        let value = line.substring(firstEquals + 1).trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        vars[key] = value;
    });
    return vars;
}

const envVars = loadEnv();
const PROJECT_ID = envVars.VERTEX_PROJECT_ID || 'railvision-480923';
const LOCATION = 'global';
const MODEL_NAME = 'gemini-3-pro-image-preview'; // Verify this model name hasn't changed to 'gemini-exp-1114' or similar

// --- Auth Setup ---
let googleAuthOptions = undefined;
if (envVars.GOOGLE_APPLICATION_CREDENTIALS) {
    const raw = envVars.GOOGLE_APPLICATION_CREDENTIALS;
    console.log(`[DEBUG] GOOGLE_APPLICATION_CREDENTIALS found. Length: ${raw.length}`);

    // Check if it's a file path
    if (fs.existsSync(raw) || raw.includes('/') || raw.includes('\\')) {
        console.log('[DEBUG] Treating credentials as FILE PATH.');
        process.env.GOOGLE_APPLICATION_CREDENTIALS = raw;
        // Do NOT set googleAuthOptions, let ADC handle it via env var
    } else {
        // Assume JSON content (raw or base64)
        console.log('[DEBUG] Treating credentials as CONTENT (Json/Base64).');
        try {
            const isBase64 = !raw.trim().startsWith('{');
            const jsonStr = isBase64 ? Buffer.from(raw, 'base64').toString('utf-8') : raw;
            googleAuthOptions = { credentials: JSON.parse(jsonStr) };
            console.log('[DEBUG] Credentials parsed successfully.');
        } catch (e) {
            console.error('[ERROR] Failed to parse credentials content:', e.message);
        }
    }
} else {
    console.warn('[WARN] No GOOGLE_APPLICATION_CREDENTIALS found in .env.local');
}

// --- Images ---
// Use existing images in public/styles
const FALLBACK_SOURCE = path.join(__dirname, '../public/styles/modern.png');
const STYLE_IMAGE_PATH = path.join(__dirname, '../public/styles/industrial.png');

// --- Constants ---
// Try US-CENTRAL1 first to verify Auth
const TEST_REGION = 'us-central1';
const TEST_MODEL = 'gemini-1.0-pro'; // More standard stable model

// Global settings for target model
const TARGET_REGION = 'global';
const TARGET_MODEL = 'gemini-3-pro-image-preview';

async function run() {
    console.log(`🚀 Starting Prompt Test [Project: ${PROJECT_ID}]`);

    // --- TEST 1: Connectivity Check (us-central1) ---
    console.log(`\n--- Test 1: Connectivity Check (${TEST_REGION}) ---`);
    const vertexAI_Local = new VertexAI({
        project: PROJECT_ID,
        location: TEST_REGION,
        googleAuthOptions
    });
    const modelLocal = vertexAI_Local.getGenerativeModel({ model: TEST_MODEL });

    try {
        const textRes = await modelLocal.generateContent({
            contents: [{ role: 'user', parts: [{ text: "Hello, input test." }] }]
        });
        console.log('✅ Connectivity OK. Response:', textRes.response.candidates[0].content.parts[0].text);
    } catch (e) {
        console.error('❌ Connectivity Check Failed:', e.message);
        if (e.message.includes('<')) console.error('  (Received HTML instead of JSON. Check Auth/Network/ProjectID)');
        // Don't exit, try global anyway just in case it's a region specific issue (unlikely)
    }

    // --- TEST 2: Target Model (Global) ---
    console.log(`\n--- Test 2: Target Model (${TARGET_MODEL} @ ${TARGET_REGION}) ---`);

    const vertexAI_Global = new VertexAI({
        project: PROJECT_ID,
        location: TARGET_REGION,
        apiEndpoint: 'aiplatform.googleapis.com', // Explicitly set for global
        googleAuthOptions
    });

    // ... continue with Image Gen ...
    if (!fs.existsSync(FALLBACK_SOURCE) || !fs.existsSync(STYLE_IMAGE_PATH)) {
        console.error('Skipping image test: Missing images');
        return;
    }
    const sourceBase64 = fs.readFileSync(FALLBACK_SOURCE).toString('base64');
    const styleBase64 = fs.readFileSync(STYLE_IMAGE_PATH).toString('base64');

    // Real generation attempt
    const SYSTEM_INSTRUCTION = `You are a world-renowned architectural visualization expert.`;
    const USER_TEMPLATE = `Analyze source geometry. Apply style from reference. Output image only.`;

    const realModel = vertexAI_Global.getGenerativeModel({
        model: TARGET_MODEL,
        systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
        }
    });

    try {
        const result = await realModel.generateContent({
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: 'image/png', data: sourceBase64 } },
                    { inlineData: { mimeType: 'image/png', data: styleBase64 } },
                    { text: USER_TEMPLATE }
                ]
            }]
        });

        const candidate = result.response.candidates[0];
        // Saved output logic...
        if (candidate.content && candidate.content.parts) {
            let saved = false;
            candidate.content.parts.forEach((p, i) => {
                if (p.inlineData) {
                    fs.writeFileSync(path.join(__dirname, 'output.png'), Buffer.from(p.inlineData.data, 'base64'));
                    console.log('✅ Image Saved to output.png');
                    saved = true;
                }
            });
            if (!saved) console.log('Text Output:', candidate.content.parts[0].text);
        }

    } catch (e) {
        console.error('❌ Image Gen Failed:', e.message);
    }
}

run();
