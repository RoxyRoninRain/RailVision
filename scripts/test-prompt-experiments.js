const { VertexAI } = require('@google-cloud/vertexai');
const fs = require('fs');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');

// --- CONFIGURATION ---
const INPUT_IMAGE_NAME = 'input';
const STYLE_IMAGE_NAME = 'Style 2';
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const RESULTS_DIR = path.resolve(__dirname, 'results');
const ENV_PATH = path.resolve(__dirname, '../.env.local');

// --- LOAD ENV ARGS ---
if (!fs.existsSync(ENV_PATH)) {
    console.error("❌ .env.local not found!");
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
const heicConvert = require('heic-convert');

async function getImageBuffer(baseName) {
    const jpgPath = path.join(FIXTURES_DIR, `${baseName}.jpg`);
    const pngPath = path.join(FIXTURES_DIR, `${baseName}.png`);
    const heicPath = path.join(FIXTURES_DIR, `${baseName}.heic`);

    if (fs.existsSync(jpgPath)) {
        console.log(`Found ${baseName}.jpg`);
        return fs.readFileSync(jpgPath);
    } else if (fs.existsSync(pngPath)) {
        console.log(`Found ${baseName}.png`);
        return fs.readFileSync(pngPath);
    } else if (fs.existsSync(heicPath)) {
        console.log(`Found ${baseName}.heic, converting to JPEG...`);
        const inputBuffer = fs.readFileSync(heicPath);
        const outputBuffer = await heicConvert({
            buffer: inputBuffer,
            format: 'JPEG',
            quality: 1
        });
        return outputBuffer;
    } else {
        return null;
    }
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
        console.error("❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS", e);
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

// --- EXPERIMENT DEFINITIONS ---
// --- EXPERIMENT DEFINITIONS ---

// Dynamic Prompt Generator for Solution G (The Combo)
function generateSolutionGPrompt(config) {
    // Default Config (Direct, Over-the-Post, Stop)
    const {
        MOUNT_STYLE = "Direct",
        POST_STYLE = "Over-the-Post",
        TERMINATION_STYLE = "Stop"
    } = config || {};

    // Logic Blocks
    const MOUNT_LOGIC = MOUNT_STYLE === "Shoe Rail"
        ? "1. LAY THE TRACK: Generate a bottom rail (Shoe) that lies FLAT on the stair nose/stringer line. All spindles must sit INSIDE this shoe."
        : "1. DIRECT MOUNT: Drill spindles directly into the treads or floor. Do NOT generate a bottom rail.";

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

3. [PROTOCOL: VISUAL CONFIRMATION]
   - The parameters (Mount: ${MOUNT_STYLE}, Post: ${POST_STYLE}) are GUIDES.
   - **TRUTH:** You must LOOK at Layer 2 to determine the actual execution.
   - If the guides say "Shoe Rail" but Layer 2 is clearly "Direct Mount", follow Layer 2.
   - Do not hallucinate a generic component if Layer 2 shows a specific custom molding profile.

4. [PROTOCOL: VOLUMETRIC FIDELITY]
   - **DO NOT THIN DOWN OR BULK UP THE POSTS.**
   - Maintain the EXACT volumetric proportions (thickness/weight) of the Newel Posts and Spindles from Layer 2.
   - If Layer 2 has thick square posts, do NOT generate thin rectangular ones. Trace the silhouette.

5. [PROTOCOL: TERMINATION LOGIC]
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
4. CROSS-CHECK with [PROTOCOL: VISUAL CONFIRMATION].
5. ENFORCE [PROTOCOL: VOLUMETRIC FIDELITY].
6. RENDER with 100% photorealism.
7. FINAL QC: CHECK against Layer 1. IF BACKGROUND CHANGED -> FAIL.
`
    };
}

const EXPERIMENTS = {
    // Solution G (Style 2 Stress Test)
    // Solution G (Style 2 Stress Test)
    // "Railify_SolutionG_Style2": generateSolutionGPrompt({
    //     MOUNT_STYLE: "Direct",
    //     POST_STYLE: "Over-the-Post",
    //     TERMINATION_STYLE: "Stop"
    // }),

    // Solution H: User Refined Prompt (Specific to Style 2)
    // "Railify_SolutionH_Style2": {
    // ... (commenting out)
    // },

    // Solution I: No Termination Toggle (Visual Inference)
    // "Railify_SolutionI_Style2": generateSolutionIPrompt({
    //     MOUNT_STYLE: "Direct",
    //     POST_STYLE: "Over-the-Post"
    // }),

    // Solution J: Logic-Gated Inference (The Fix for I)
    "Railify_SolutionJ_Style2": generateSolutionJPrompt({
        MOUNT_STYLE: "Direct",
        POST_STYLE: "Over-the-Post"
    })
};

// Dynamic Prompt Generator for Solution J (Logic-Gated Inference)
function generateSolutionJPrompt(config) {
    const {
        MOUNT_STYLE = "Direct",
        POST_STYLE = "Over-the-Post"
    } = config || {};

    const MOUNT_LOGIC = MOUNT_STYLE === "Shoe Rail"
        ? "1. LAY THE TRACK: Generate a bottom rail (Shoe) that lies FLAT on the stair nose/stringer line. All spindles must sit INSIDE this shoe."
        : "1. DIRECT MOUNT: Drill spindles directly into the treads or floor. Do NOT generate a bottom rail.";

    const POST_LOGIC = POST_STYLE === "Over-the-Post"
        ? "2. CONTINUOUS RAIL: The handrail must run CONTINUOUSLY over the tops of the Newel Posts (Over-the-Post style). Do not break the line."
        : "2. POST-TO-POST: The handrail must terminate into the SIDE of the Newel Posts (Post-to-Post style). Place a Cap on the post top.";

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

3. [PROTOCOL: VISUAL CONFIRMATION]
   - The parameters (Mount: ${MOUNT_STYLE}, Post: ${POST_STYLE}) are GUIDES.
   - **TRUTH:** You must LOOK at Layer 2 to determine the actual execution.
   - If the guides say "Shoe Rail" but Layer 2 is clearly "Direct Mount", follow Layer 2.

4. [PROTOCOL: TERMINATION LOGIC]
   - ${POST_LOGIC}
   - **3. TERMINATION CLASSIFIER (STRICT):**
     - Look at the RAIL ENDING in Layer 2.
     - IF it curls -> Generate a Volute.
     - IF it scrolls down -> Generate a Lambs Tongue.
     - IF it stops/dead-ends -> Generate a Stop.
     - **WARNING: COPY ONLY THE RAIL ENDING SHAPE. DO NOT COPY THE ROOM/WALLS FROM LAYER 2.**

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
   - TERMINATION: Match Style Reference (Rail Ending Only).
4. CROSS-CHECK with [PROTOCOL: VISUAL CONFIRMATION].
5. RENDER with 100% photorealism.
6. FINAL QC: CHECK against Layer 1. IF BACKGROUND CHANGED -> FAIL.
`
    };
}

// Dynamic Prompt Generator for Solution I (No Termination Toggle)
function generateSolutionIPrompt(config) {
    const {
        MOUNT_STYLE = "Direct",
        POST_STYLE = "Over-the-Post"
    } = config || {};

    const MOUNT_LOGIC = MOUNT_STYLE === "Shoe Rail"
        ? "1. LAY THE TRACK: Generate a bottom rail (Shoe) that lies FLAT on the stair nose/stringer line. All spindles must sit INSIDE this shoe."
        : "1. DIRECT MOUNT: Drill spindles directly into the treads or floor. Do NOT generate a bottom rail.";

    const POST_LOGIC = POST_STYLE === "Over-the-Post"
        ? "2. CONTINUOUS RAIL: The handrail must run CONTINUOUSLY over the tops of the Newel Posts (Over-the-Post style). Do not break the line."
        : "2. POST-TO-POST: The handrail must terminate into the SIDE of the Newel Posts (Post-to-Post style). Place a Cap on the post top.";

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

3. [PROTOCOL: VISUAL CONFIRMATION]
   - The parameters (Mount: ${MOUNT_STYLE}, Post: ${POST_STYLE}) are GUIDES.
   - **TRUTH:** You must LOOK at Layer 2 to determine the actual execution.
   - If the guides say "Shoe Rail" but Layer 2 is clearly "Direct Mount", follow Layer 2.

4. [PROTOCOL: TERMINATION LOGIC]
   - ${POST_LOGIC}
   - **3. TERMINATION: Look at Layer 2. Does it end in a Coil (Volute)? A Downward Scroll (Lambs Tongue)? Or a Simple Stop? REPLICATE THE EXACT ENDING.**

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
   - TERMINATION: [INFER FROM LAYER 2]
4. CROSS-CHECK with [PROTOCOL: VISUAL CONFIRMATION].
5. RENDER with 100% photorealism.
6. FINAL QC: CHECK against Layer 1. IF BACKGROUND CHANGED -> FAIL.
`
    };
}


// --- EXECUTION ---
async function runExperiments() {
    // 1. Find all input images
    const files = fs.readdirSync(FIXTURES_DIR);
    const inputFiles = files.filter(f => f.startsWith('input') && (f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.heic')));

    if (inputFiles.length === 0) {
        console.error("❌ No input files found! Place 'input1.jpg', 'input2.jpg', etc. in scripts/fixtures/");
        process.exit(1);
    }

    const styleBuffer = await getImageBuffer(STYLE_IMAGE_NAME);
    if (!styleBuffer) {
        console.error("❌ Style image missing! Place 'style.(jpg|png|heic)' in scripts/fixtures/");
        process.exit(1);
    }
    const styleBase64 = styleBuffer.toString('base64');

    const token = await getAccessToken();
    if (!token) return;

    console.log(`🚀 Starting Extended Experiments on ${inputFiles.length} inputs...`);

    // 2. Loop Inputs
    for (const inputFile of inputFiles) {
        const inputName = path.parse(inputFile).name;
        console.log(`\n📂 Processing Input: ${inputName} `);

        // Load Input
        let inputBuffer;
        const jpgPath = path.join(FIXTURES_DIR, `${inputName}.jpg`);
        const pngPath = path.join(FIXTURES_DIR, `${inputName}.png`);
        const heicPath = path.join(FIXTURES_DIR, `${inputName}.heic`);

        if (fs.existsSync(jpgPath)) {
            inputBuffer = fs.readFileSync(jpgPath);
        } else if (fs.existsSync(pngPath)) {
            inputBuffer = fs.readFileSync(pngPath);
        } else if (fs.existsSync(heicPath)) {
            inputBuffer = await heicConvert({ buffer: fs.readFileSync(heicPath), format: 'JPEG' });
        } else {
            console.error(`❌ Input file for ${inputName} not found!`);
            continue;
        }
        const inputBase64 = inputBuffer.toString('base64');
        console.log(`   📏 Input Size: ${inputBase64.length} chars | Hash: ${inputBase64.substring(0, 15)}...`);

        // 3. Loop Experiments
        for (const [expName, prompts] of Object.entries(EXPERIMENTS)) {
            // Skip commented out experiments if any

            console.log(`  🧪 Experiment: ${expName} `);

            const parts = [
                { text: prompts.user },
                { inlineData: { mimeType: 'image/jpeg', data: inputBase64 } },
                { inlineData: { mimeType: 'image/jpeg', data: styleBase64 } }
            ];

            const payload = {
                contents: [{ role: 'user', parts }],
                generationConfig: {
                    temperature: 0.3, // RETOUCHER PRECISION
                    maxOutputTokens: 2048
                },
                systemInstruction: { parts: [{ text: prompts.system }] }
            };

            const url = `https://aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/global/publishers/google/models/gemini-3-pro-image-preview:generateContent`;

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    console.error(`    ❌ API Error:`, await response.text());
                    continue;
                }

                const data = await response.json();
                const candidate = data.candidates?.[0];

                if (!candidate) {
                    console.error(`    ❌ No candidate`);
                    continue;
                }

                for (const part of candidate.content.parts) {
                    if (part.inlineData) {
                        const buffer = Buffer.from(part.inlineData.data, 'base64');
                        const filename = path.join(RESULTS_DIR, `${inputName}_${expName}.jpg`);
                        fs.writeFileSync(filename, buffer);
                        console.log(`    ✅ Saved: ${filename}`);
                    }
                }
            } catch (err) {
                console.error(`    🔥 Error:`, err.message);
            }
        }
    }
}

runExperiments();
