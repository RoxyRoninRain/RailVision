const { VertexAI } = require('@google-cloud/vertexai');
const fs = require('fs');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');
const heicConvert = require('heic-convert');

// --- ARGS PARSING ---
const args = process.argv.slice(2);
const getArg = (name, defaultVal) => {
    const idx = args.findIndex(a => a.startsWith(`--${name}=`));
    if (idx !== -1) return args[idx].split('=')[1];
    return defaultVal;
};

// --- CONFIGURATION ---
const STRATEGY_NAME = getArg('strategy', 'Default');
const INPUT_FILTER = getArg('input', 'all');
const STYLE_IMAGE_NAME = getArg('style', 'style_test_2');
const WORKSPACE_ROOT = process.cwd();
const FIXTURES_DIR = path.resolve(WORKSPACE_ROOT, 'scripts', 'fixtures');
const RESULTS_ROOT = path.resolve(WORKSPACE_ROOT, '.agent/skills/ai_lab/results');
const ENV_PATH = path.resolve(WORKSPACE_ROOT, '.env.local');

// Ensure results dir exists
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const RUN_DIR = path.resolve(RESULTS_ROOT, `${timestamp}_${STRATEGY_NAME}`);

if (!fs.existsSync(RUN_DIR)) {
    fs.mkdirSync(RUN_DIR, { recursive: true });
}

// --- SETUP LOGGING ---
const logFile = path.join(RUN_DIR, 'report.md');
function log(msg) {
    console.log(msg);
    fs.appendFileSync(logFile, `${msg}\n`);
}

log(`# Experiment Report: ${STRATEGY_NAME}\n`);
log(`**Date:** ${new Date().toLocaleString()}`);
log(`**Style:** ${STYLE_IMAGE_NAME}`);
log(`**Input Filter:** ${INPUT_FILTER}\n`);

// --- LOAD ENV ---
if (!fs.existsSync(ENV_PATH)) {
    log("❌ .env.local not found!");
    process.exit(1);
}
const envContent = fs.readFileSync(ENV_PATH, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) envVars[key.trim()] = value.trim();
});

const PROJECT_ID = envVars.VERTEX_PROJECT_ID;
const GOOGLE_APP_CREDS = envVars.GOOGLE_APPLICATION_CREDENTIALS;

// --- FILE HELPER ---
async function getImageBuffer(baseName) {
    const jpgPath = path.join(FIXTURES_DIR, `${baseName}.jpg`);
    const pngPath = path.join(FIXTURES_DIR, `${baseName}.png`);
    const heicPath = path.join(FIXTURES_DIR, `${baseName}.heic`);

    if (fs.existsSync(jpgPath)) return fs.readFileSync(jpgPath);
    if (fs.existsSync(pngPath)) return fs.readFileSync(pngPath);
    if (fs.existsSync(heicPath)) {
        log(`Converting ${baseName}.heic...`);
        const inputBuffer = fs.readFileSync(heicPath);
        return await heicConvert({ buffer: inputBuffer, format: 'JPEG', quality: 1 });
    }
    return null;
}

// --- AUTH HELPER ---
async function getAccessToken() {
    let credentials;
    try {
        const credsStr = GOOGLE_APP_CREDS;
        const isBase64 = !credsStr.trim().startsWith('{');
        const jsonStr = isBase64 ? Buffer.from(credsStr, 'base64').toString('utf-8') : credsStr;
        credentials = JSON.parse(jsonStr);
    } catch (e) {
        log("❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS: " + e.message);
        return null;
    }

    const auth = new GoogleAuth({
        credentials,
        scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token;
}

// --- PROMPTS ---

function generateSolutionHPrompt(config) {
    const {
        MOUNT_STYLE = "Shoe Rail",
        POST_STYLE = "Over-the-Post",
        TERMINATION_STYLE = "Lambs Tongue"
    } = config || {};

    const MOUNT_LOGIC = MOUNT_STYLE === "Shoe Rail"
        ? "1. LAY THE TRACK: Generate a bottom rail (Shoe) that lies FLAT on the stair nose/stringer line. All spindles must sit INSIDE this shoe."
        : "1. DIRECT MOUNT: Generate spindles that STAND UPON the existing tread surface. Do NOT generate a bottom rail. **Do NOT modify the tread pixels.** Simply place the spindle base on top.";

    const POST_LOGIC = POST_STYLE === "Over-the-Post"
        ? "2. CONTINUOUS RAIL: The handrail must run CONTINUOUSLY over the tops of the Newel Posts (Over-the-Post style). Do not break the line."
        : "2. POST-TO-POST: The handrail must terminate into the SIDE of the Newel Posts (Post-to-Post style). Place a Cap on the post top.";

    const TERM_LOGIC = TERMINATION_STYLE === "Lambs Tongue"
        ? "3. TERMINATION: End the handrail with a decorative downward scroll (Lambs Tongue)."
        : `3. TERMINATION: End the handrail with a ${TERMINATION_STYLE}.`;

    return {
        system: `ROLE:
You are "Railify-AI," a digital fabricator.
INPUT DATA STRUCTURE:
1. LAYER 1 (The Anchor): The User's Photo. (IMMUTABLE BACKGROUND).
2. LAYER 2 (The Product): The Style Reference. (VISUAL DNA SWATCH).
***
PRIME DIRECTIVE (NON-NEGOTIABLE):
**YOU MUST NOT ALTER THE ROOM.**
Walls, Floors, Windows, Stairs, Lighting, and Furniture are LOCKED.
Your ONLY permission is to add a handrail.
If you change a single pixel of the background -> YOU FAIL.

CORE PROTOCOLS:
1. [PROTOCOL: GEOMETRY & MOUNTING]
   - ACTION: Trace the outer edge of the stair treads.
   - ${MOUNT_LOGIC}

2. [PROTOCOL: VISUAL DNA CLONING]
   - **CRITICAL: LAYER 2 IS NOT A SCENE.** It is a parts catalog.
   - EXTRACT ONLY: Spindle Pattern, Rail Profile, and Finish.
   - **CLONE**: Texture map the visible details.

3. [PROTOCOL: VOLUMETRIC FIDELITY]
   - **DO NOT THIN DOWN OR BULK UP THE POSTS.**
   - Maintain the EXACT volumetric proportions (thickness/weight) of the Newel Posts and Spindles from Layer 2.
   - If Layer 2 has thick square posts, do NOT generate thin rectangular ones. Trace the silhouette.

4. [PROTOCOL: TERMINATION LOGIC]
   - ${POST_LOGIC}
   - ${TERM_LOGIC}

FINAL QC INSTRUCTION:
Compare your final image with Layer 1.
Did you change the wall color? Did you move a window? Did you warp the stairs?
If YES -> STOP. REVERT to Layer 1 pixels immediately.
`,
        user: `[TASK ORDER]
INPUTS:
- LAYER 1 (Scene): [Attached Image A]
- LAYER 2 (Style): [Attached Image B]

EXECUTION:
1. ANALYZE Layer 1 to find the stair path.
2. CONSTRUCT the rail using [PROTOCOL: GEOMETRY].
3. APPLY the style triggers:
   - MOUNT: ${MOUNT_STYLE}
   - POSTS: ${POST_STYLE}
   - ENDS: ${TERMINATION_STYLE}
4. ENFORCE [PROTOCOL: VOLUMETRIC FIDELITY].
5. RENDER with 100% photorealism.
6. FINAL QC: CHECK against Layer 1. IF BACKGROUND CHANGED -> FAIL.
`
    };
}

function generatePrompt(strategyName) {
    // Map CLI names to config
    if (strategyName.includes("SolutionH") || strategyName === "Default") {
        return generateSolutionHPrompt({
            MOUNT_STYLE: "Direct",
            POST_STYLE: "Over-the-Post",
            TERMINATION_STYLE: "Stop"
        });
    }

    console.log(`⚠️ Warning: Unknown strategy '${strategyName}', using Default (Solution H)`);
    return generateSolutionHPrompt({
        MOUNT_STYLE: "Direct",
        POST_STYLE: "Over-the-Post",
        TERMINATION_STYLE: "Stop"
    });
}

// --- MAIN LOOP ---
async function run() {
    // 1. Inputs
    const files = fs.readdirSync(FIXTURES_DIR);
    let inputFiles = files.filter(f => f.startsWith('input') && (f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.heic')));

    if (INPUT_FILTER !== 'all') {
        inputFiles = inputFiles.filter(f => f.includes(INPUT_FILTER));
    }

    if (inputFiles.length === 0) {
        log("❌ No input files found matching filter.");
        process.exit(1);
    }

    const styleBuffer = await getImageBuffer(STYLE_IMAGE_NAME);
    if (!styleBuffer) {
        log(`❌ Style image '${STYLE_IMAGE_NAME}' missing in fixtures!`);
        process.exit(1);
    }
    const styleBase64 = styleBuffer.toString('base64');

    const token = await getAccessToken();
    if (!token) return;

    log(`🚀 Starting Run: ${inputFiles.length} inputs...`);

    const promptData = generatePrompt(STRATEGY_NAME);

    for (const inputFile of inputFiles) {
        const inputName = path.parse(inputFile).name;
        log(`\n📂 Processing: ${inputName}`);

        const inputBuffer = await getImageBuffer(inputName);
        if (!inputBuffer) continue;
        const inputBase64 = inputBuffer.toString('base64');

        const parts = [
            { text: promptData.user },
            { inlineData: { mimeType: 'image/jpeg', data: inputBase64 } },
            { inlineData: { mimeType: 'image/jpeg', data: styleBase64 } }
        ];

        const payload = {
            contents: [{ role: 'user', parts }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 2048
            },
            systemInstruction: { parts: [{ text: promptData.system }] }
        };

        const url = `https://aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/global/publishers/google/models/gemini-3-pro-image-preview:generateContent`;

        try {
            const start = Date.now();
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                log(`    ❌ API Error: ${await response.text()}`);
                continue;
            }

            const data = await response.json();
            const duration = ((Date.now() - start) / 1000).toFixed(1);
            const candidate = data.candidates?.[0];

            if (!candidate) {
                log(`    ❌ No candidate returned.`);
                continue;
            }

            // Log thinking/text if present
            const textPart = candidate.content.parts.find(p => p.text);
            if (textPart) {
                log(`    💬 Model Thought: ${textPart.text.substring(0, 100)}...`);
            }

            // Save Image
            const imgPart = candidate.content.parts.find(p => p.inlineData);
            if (imgPart) {
                const buffer = Buffer.from(imgPart.inlineData.data, 'base64');
                const filename = path.join(RUN_DIR, `${inputName}.jpg`);
                fs.writeFileSync(filename, buffer);
                log(`    ✅ Saved: ${filename} (${duration}s)`);
            } else {
                log(`    ⚠️ No image generated.`);
            }

        } catch (err) {
            log(`    🔥 Error: ${err.message}`);
        }
    }

    log(`\nDone! Results in ${RUN_DIR}`);
}

run();
