const { VertexAI } = require('@google-cloud/vertexai');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const PROJECT_ID = process.env.VERTEX_PROJECT_ID || 'railvision-480923';
// GLOBAL region usually has better model availability for newer models
const LOCATION = 'global';
const MODEL_NAME = 'gemini-3-pro-image-preview';

// --- Paths ---
const OUTPUT_IMAGE = path.join(__dirname, 'output.png');
const SOURCE_IMAGE = path.join(__dirname, '../public/styles/modern.png');
const STYLE_IMAGE = path.join(__dirname, '../public/styles/industrial.png');

// --- Env Loader ---
function loadEnv() {
    const envPath = path.resolve(__dirname, '../.env.local');
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, 'utf8');
    const vars = {};
    content.split('\n').forEach(line => {
        const firstEquals = line.indexOf('=');
        if (firstEquals === -1) return;
        const key = line.substring(0, firstEquals).trim();
        let value = line.substring(firstEquals + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        vars[key] = value;
    });
    return vars;
}

const envVars = loadEnv();
let googleAuthOptions = undefined;
if (envVars.GOOGLE_APPLICATION_CREDENTIALS) {
    const raw = envVars.GOOGLE_APPLICATION_CREDENTIALS;
    if (fs.existsSync(raw) || raw.includes('/') || raw.includes('\\')) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = raw;
    } else {
        try {
            const isBase64 = !raw.trim().startsWith('{');
            const jsonStr = isBase64 ? Buffer.from(raw, 'base64').toString('utf-8') : raw;
            googleAuthOptions = { credentials: JSON.parse(jsonStr) };
        } catch (e) { }
    }
}

const vertexAI = new VertexAI({
    project: PROJECT_ID,
    location: LOCATION,
    apiEndpoint: 'aiplatform.googleapis.com', // Explicitly set for global
    googleAuthOptions
});

async function run() {
    console.log(`🧐 Starting Analysis [${LOCATION} :: ${MODEL_NAME}]...`);

    if (!fs.existsSync(OUTPUT_IMAGE)) {
        console.error('❌ No output.png found. Run test-prompt.js first.');
        process.exit(1);
    }

    if (!fs.existsSync(SOURCE_IMAGE) || !fs.existsSync(STYLE_IMAGE)) {
        console.error('❌ Missing source or style images.');
        process.exit(1);
    }

    const outputBase64 = fs.readFileSync(OUTPUT_IMAGE).toString('base64');
    const sourceBase64 = fs.readFileSync(SOURCE_IMAGE).toString('base64');
    const styleBase64 = fs.readFileSync(STYLE_IMAGE).toString('base64');

    const model = vertexAI.getGenerativeModel({
        model: MODEL_NAME,
        systemInstruction: { parts: [{ text: "You are a QA expert for architectural AI." }] }
    });

    const prompt = `I will show you 3 images:
1. Source Image (The original room/stairs)
2. Style Reference (The desired handrail style)
3. Output Image (The AI generated renovation)

Critique the Output Image:
1. GEOMETRY INTEGRITY: Did it keep the original stairs/room perspective exactly? (Yes/No + Details)
2. STYLE APPLICATION: Did it apply the handrail style from the reference? (Yes/No + Details)
3. PHOTOREALISM: Rate 1-10. Is it blurry? Artifacts?
4. HALLUCINATIONS: Did it change the floor? The window?

Provide a concise summary.`;

    const parts = [
        { text: "IMAGE 1: SOURCE TO PRESERVE" },
        { inlineData: { mimeType: 'image/png', data: sourceBase64 } },
        { text: "IMAGE 2: STYLE REFERENCE" },
        { inlineData: { mimeType: 'image/png', data: styleBase64 } },
        { text: "IMAGE 3: AI OUTPUT TO CRITIQUE" },
        { inlineData: { mimeType: 'image/png', data: outputBase64 } },
        { text: prompt }
    ];

    try {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts }]
        });

        console.log('\n--- ANALYSIS RESULTS ---');
        console.log(result.response.candidates[0].content.parts[0].text);

    } catch (e) {
        console.error('❌ Analysis Error:', e.message);
        if (e.message.includes('404')) console.error("Try checking if the model name is correct for the region.");
    }
}

run();
