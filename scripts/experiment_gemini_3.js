const { GoogleAuth } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const RESULTS_DIR = path.resolve(__dirname, 'results/experiment_gemini_3');
const ENV_PATH = path.resolve(__dirname, '../.env.local');

if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// --- LOAD ENV ARGS ---
const envContent = fs.readFileSync(ENV_PATH, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) envVars[key.trim()] = value.trim();
});

const PROJECT_ID = envVars.VERTEX_PROJECT_ID;

// --- AUTH HELPER ---
async function getAccessToken() {
    const creds = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../service-account.json'), 'utf8'));
    const auth = new GoogleAuth({
        credentials: creds,
        scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token;
}

// --- PROMPTS ---
const SYSTEM_PROMPT = `**ROLE:** You are Railify-AI, an expert Architectural Visualization Engine.
**TASK:** Renovate the user's staircase by overlaying a new handrail system.
**CRITICAL: DO NOT OUTPUT TEXT OR JSON. DO NOT OUTPUT CODE. DO NOT ATTEMPT TO USE SEARCH OR TOOLS.**
**YOU MUST OUTPUT THE GENERATED IMAGE BYTES DIRECTLY.**
**JSON OUTPUT = FAILURE. TEXT OUTPUT = FAILURE.**
**DATA LAYERS (STRICT ADHERENCE):**
**LAYER 1: THE SCENE (IMAGE A)**
*   **Status:** IMMUTABLE BACKGROUND.
*   **Rule:** You must NEVER alter the walls, flooring, stair pitch, or lighting. The geometry of the house is locked.
*   **Aspect Ratio** do not change from the image A original aspect ratio.
**LAYER 2: THE PRODUCT (HANDRAIL)**
*   **Status:** THE ONLY VARIABLE.
*   **Source:** Image B, IGNORE BACKGROUND, USE HANDRAIL COMPONENTS ONLY.
*   **Physics:** The rail must track the *Nosing Line* relative to Layer 1.
**STRICT PROHIBITIONS (FATAL ERRORS):**
*   **NO GHOSTING:** Spindles must NEVER pass through a Shoe Rail. (Shoe Rail = Solid Barrier).
*   **NO WARPING:** Do not change the angle or number of steps in the staircase.
*   **NO HALLUCINATIONS:** Do not invent windows, doors, structures or furniture that do not exist in Layer 1.
*   **NO CHANGING:** DO not change the railing style.
*   **If you change a single pixel of the background -> YOU FAIL.
**OUTPUT FORMAT:**
*   **Single Image Identity:** One unified image of Image A room and stairs, but with the handrail style from Image B installed properly on the Image A stairs.
*   **Camera Lock:** Exact aspect ratio and POV of Image A.
*   **Quality Control:** Compare the pixels of new generated image with Image A. If you changed the architecture of the house or steps, revert them back to Image A Pixels. THE HANDRAILS ARE THE ONLY CHANGES THAT CAN BE MADE. EVERYTHING ELSE MUST REMAIN EXACTLY AS THEY ARE IN IMAGE A.`;

const USER_PROMPT = `[INPUTS]
**LAYER 1 (Scene):** User's Staircase (Image A)
**LAYER 2 (Reference):** Handrail Style (Image B)
***
**EXECUTION ORDER:**
1.  **Analyze:** Is there a handrail already in the image? If Yes, proceed to step 2. If No, Move on to step 3.
2.  **Masking:** Digitally mask out the old rail from Layer 1. Heal the background.
3.  **Style:** Analyze Image B, Identify all handrail Components and prepare to design the new handrail with these components. 
4.  **Composition:** Render the new system into the active zone.
**Mounting Check:** Analyze Layer 2 for Shoe Rail vs Direct Mount.
**Post Style:** Analyze Layer 2 for Post style.
**Termination:** Analyze Layer 2 for termination style.
5. 100% Photorealism
6.  **Finalize:** Quality Control, then Apply Layer 1's lighting map to Layer 2's material.`;

const heicConvert = require('heic-convert');

async function runComparison(inputName, styleName, token) {
    console.log(`\n📂 Comparing ${inputName} with style ${styleName}`);

    async function getFileData(baseName, folder) {
        const jpgPath = path.join(folder, `${baseName}.jpg`);
        const heicPath = path.join(folder, `${baseName}.heic`);

        if (fs.existsSync(jpgPath)) {
            return fs.readFileSync(jpgPath);
        } else if (fs.existsSync(heicPath)) {
            console.log(`    Converting ${baseName}.heic to JPEG...`);
            const buffer = fs.readFileSync(heicPath);
            return await heicConvert({ buffer, format: 'JPEG', quality: 1 });
        }
        throw new Error(`File not found: ${baseName}`);
    }

    const inputBuffer = await getFileData(inputName, FIXTURES_DIR);
    const styleBuffer = await getFileData(styleName, FIXTURES_DIR);

    const inputBase64 = inputBuffer.toString('base64');
    const styleBase64 = styleBuffer.toString('base64');

    const models = [
        { id: 'gemini-3-pro-image-preview', name: 'PRO' },
        { id: 'gemini-3-flash-preview', name: 'FLASH' }
    ];

    const fetch = (await import('node-fetch')).default;

    for (const model of models) {
        console.log(`  🧪 Model: ${model.name} (${model.id})`);
        const start = Date.now();

        const url = `https://aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/global/publishers/google/models/${model.id}:generateContent`;

        const parts = [
            { text: USER_PROMPT },
            { inlineData: { mimeType: 'image/jpeg', data: inputBase64 } },
            { inlineData: { mimeType: 'image/jpeg', data: styleBase64 } }
        ];

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts }],
                    generationConfig: {
                        temperature: 0.4,
                        maxOutputTokens: 2048
                    },
                    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }
                })
            });

            const duration = (Date.now() - start) / 1000;

            if (!response.ok) {
                console.error(`    ❌ Error (${response.status}):`, await response.text());
                continue;
            }

            const data = await response.json();
            const candidate = data.candidates?.[0];

            if (candidate) {
                console.log(`    📦 Received ${candidate.content.parts.length} parts from model.`);
                for (let i = 0; i < candidate.content.parts.length; i++) {
                    const part = candidate.content.parts[i];
                    const partTypes = Object.keys(part).join(', ');
                    console.log(`    Part ${i} types: [${partTypes}]`);

                    if (part.inlineData) {
                        const outBuffer = Buffer.from(part.inlineData.data, 'base64');
                        const outPath = path.join(RESULTS_DIR, `${inputName}_${model.name}.jpg`);
                        fs.writeFileSync(outPath, outBuffer);
                        console.log(`    ✅ Success! Duration: ${duration.toFixed(2)}s | Saved: ${outPath}`);
                    }
                    if (part.thought) {
                        console.log(`    💭 Thought extracted (trimmed): ${part.text.substring(0, 100)}...`);
                    }
                    if (part.text && !part.thought) {
                        console.log(`    📝 Text part extracted (trimmed): ${part.text.substring(0, 100)}...`);
                    }
                }
            } else {
                console.error(`    ❌ No candidate returned.`);
            }
        } catch (err) {
            console.error(`    🔥 Fetch Error:`, err.message);
        }
    }
}

async function run() {
    const token = await getAccessToken();
    // Test on one pair for quick feedback
    await runComparison('input1', 'Style 2', token);
}

run();
