import fs from 'fs';

// STRICT LAZY LOAD: Do NOT import types from @google-cloud/vertexai at top level
// This prevents the build system from trying to resolve the module during static analysis.

// Singleton instances (typed as any to avoid top-level import)
let vertexAI: any = null;
let vertexAIGlobal: any = null;
let routerModel: any = null;
let imagenModel: any = null;

// Helper to dynamically load the VertexAI constructor
async function loadVertexAI() {
    const { VertexAI } = await import('@google-cloud/vertexai');
    return VertexAI;
}

async function getAccessToken(clientEmail?: string, privateKey?: string): Promise<string> {
    const { GoogleAuth } = await import('google-auth-library');
    const options: any = {
        scopes: 'https://www.googleapis.com/auth/cloud-platform'
    };
    if (clientEmail && privateKey) {
        options.credentials = { client_email: clientEmail, private_key: privateKey };
    }
    const auth = new GoogleAuth(options);
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token || '';
}

interface GoogleAuthResult {
    credentials?: {
        client_email: string;
        private_key: string;
    };
    projectId?: string;
}

function getGoogleAuthOptions(): GoogleAuthResult {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        try {
            const credsStr = process.env.GOOGLE_APPLICATION_CREDENTIALS.trim();
            let jsonStr = credsStr;
            if (fs.existsSync(credsStr)) {
                jsonStr = fs.readFileSync(credsStr, 'utf8');
            } else if (!credsStr.startsWith('{')) {
                jsonStr = Buffer.from(credsStr, 'base64').toString('utf-8');
            }
            const creds = JSON.parse(jsonStr);
            console.log('[DEBUG] Credentials parsed successfully (Lazy Load)');
            return {
                credentials: {
                    client_email: creds.client_email,
                    private_key: creds.private_key,
                },
                projectId: creds.project_id
            };
        } catch (e) {
            console.error("[ERROR] Failed to parse GOOGLE_APPLICATION_CREDENTIALS", e);
        }
    }
    return {};
}

export async function getVertexClient(isGlobal = false): Promise<any> {
    const VertexAIConstructor = await loadVertexAI();

    if (isGlobal) {
        if (!vertexAIGlobal) {
            const authOptions = getGoogleAuthOptions();
            vertexAIGlobal = new VertexAIConstructor({
                project: authOptions.projectId || process.env.VERTEX_PROJECT_ID || 'mock-project',
                location: 'global', // Restore Global for Gemini 3 as per original intent
                apiEndpoint: 'aiplatform.googleapis.com',
                googleAuthOptions: authOptions.credentials ? { credentials: authOptions.credentials } : undefined
            });
        }
        return vertexAIGlobal;
    }

    if (!vertexAI) {
        const authOptions = getGoogleAuthOptions();
        vertexAI = new VertexAIConstructor({
            project: authOptions.projectId || process.env.VERTEX_PROJECT_ID || 'mock-project',
            location: 'us-central1',
            apiEndpoint: 'us-central1-aiplatform.googleapis.com',
            googleAuthOptions: authOptions.credentials ? { credentials: authOptions.credentials } : undefined
        });
    }
    return vertexAI;
}

async function getRouterModel() {
    if (!routerModel) {
        const client = await getVertexClient(false);
        routerModel = client.getGenerativeModel({
            model: 'gemini-3.1-flash-lite'
        });
    }
    return routerModel;
}

async function getImagenModel() {
    if (!imagenModel) {
        const client = await getVertexClient(false);
        imagenModel = client.getGenerativeModel({
            model: 'imagen-3.0-capability-001'
        });
    }
    return imagenModel;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const DEFAULT_SYSTEM_INSTRUCTION = `**ROLE:** You are Railify-AI, an expert Architectural Visualization Engine.
**TASK:** Renovate the user's staircase by overlaying a new handrail system.
**DATA LAYERS (STRICT ADHERENCE):**
**LAYER 1: THE SCENE (IMAGE A)**
*   **Status:** IMMUTABLE BACKGROUND. **CRITICAL:** THE ROOM GEOMETRY IS LOCKED.
*   **Rule:** You must NOT alter the walls, flooring, stair pitch, windows, lighting, or furniture.
*   **Exception:** You may perform "Digital Cleanup" (remove trash/tools), but NEVER move a wall or stair tread.
**LAYER 2: THE PRODUCT (HANDRAIL)**
*   **Status:** THE ONLY VARIABLE. **CRITICAL:** THIS IS A REFERENCE ONLY.
*   **Source:** References (B/C).
*   **Physics:** The rail must track the *Nosing Line* relative to Layer 1.
**STRICT PROHIBITIONS (FATAL ERRORS):**
*   **NO STYLE TRANSFER:** Do NOT output Image B. Your canvas is Image A.
*   **NO GHOSTING:** Spindles must NEVER pass through a Shoe Rail.
*   **NO WARPING:** Do not change the angle or number of steps.
*   **NO COLLAGES:** Single full-screen view only.
*   **NO HALLUCINATIONS:** FAST FAIL if you create windows, doors, or furniture that do not exist.
*   **NO TEXT OUTPUT:** RETURN ONLY THE IMAGE. DO NOT EXPLAIN YOUR THINKING.
**OUTPUT FORMAT:**
*   **Single Image Identity:** One unified photograph.
*   **Camera Lock:** Exact aspect ratio and POV of Image A.`;

export async function generateDesignWithNanoBanana(
    base64TargetImage: string,
    styleInput: string | { 
        base64StyleImages: string[]; 
        technicalSpecs?: { 
            hasBottomRail?: boolean; 
            hasReducers?: boolean | null; 
            description?: string; 
            customNote?: string; 
        } 
    },
    promptConfig?: { systemInstruction: string; userTemplate: string; negative_prompt?: string }
): Promise<{ success: boolean; image?: string; error?: string; usage?: { inputTokens: number; outputTokens: number } }> {
    const maxAttempts = 5;
    let attempts = 0;

    const isReducerRequired = typeof styleInput !== 'string' && styleInput.technicalSpecs?.hasReducers === true;

    // Use lazy getter for the model
    let model;
    let finalSystemInstruction = '';
    try {
        const client = await getVertexClient(true); // Restore usage of Global Client for Nano Banana
        let baseSystemInstruction = (promptConfig?.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION)
            .replace('{{DATE}}', new Date().toISOString().split('T')[0]);

        finalSystemInstruction = baseSystemInstruction;

        console.log('--- SYSTEM INSTRUCTION ---');
        console.log(finalSystemInstruction);
        console.log('--- END SYSTEM INSTRUCTION ---');

        model = client.getGenerativeModel({
            model: 'gemini-3.1-flash-image', // Restore User's Required Model
            systemInstruction: finalSystemInstruction
        });

        console.log('[VERTEX] Model initialized. Starting generation request with 45s timeout...');

    } catch (e) {
        console.warn("[VERTEX] Lazily init failed:", e);
        return { success: false, error: "AI Service Unavailable: Initialization Failed" };
    }

    while (attempts < maxAttempts) {
        try {
            console.log(`[NANO BANANA] Generation attempt ${attempts + 1} of ${maxAttempts}...`);

            const parts: any[] = [];

            // 1. Target Image (Image A)
            parts.push({ text: "**IMAGE A (Canvas):** The user's original staircase." });
            parts.push({
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64TargetImage
                }
            });

            // 2. Style Images (Image B & C)
            if (typeof styleInput === 'string') {
                console.log('[DEBUG] Text-only style, skipping Image B/C slots');
            } else {
                const styleImages = styleInput.base64StyleImages;
                if (styleImages.length > 0) {
                    parts.push({ text: "**IMAGE B (Primary Style):** The primary aesthetic and design reference (Style Guide)." });
                    parts.push({
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: styleImages[0]
                        }
                    });

                    if (styleImages.length > 1) {
                        parts.push({ text: "**IMAGE C (Detailed Context References):** Additional reference photos providing extra context, close-up fabrication details, hardware, and construction methods." });
                        for (let i = 1; i < styleImages.length; i++) {
                            parts.push({
                                inlineData: {
                                    mimeType: 'image/jpeg',
                                    data: styleImages[i]
                                }
                            });
                        }
                    }
                }
            }


            // DYNAMIC FABRICATION & MOUNTING INSTRUCTIONS
            let mountingInstructionStep = "2.  **Analysis:** Extract the Style (Material) and Mounting Tech (Shoe vs Direct) from Layer 2."; // Default generic fallback
            let reducerInstructionStep = "";
            let styleSpecsStep = "";
            let customNoteStep = "";

            if (typeof styleInput !== 'string' && styleInput.technicalSpecs) {
                const specs = styleInput.technicalSpecs as any;
                if (specs.hasBottomRail !== undefined && specs.hasBottomRail !== null) {
                    if (specs.hasBottomRail) {
                        // CASE 1: SHOE RAIL REQUIRED
                        mountingInstructionStep = `2.  **Mounting (SHOE RAIL):** The user requires a **Shoe Rail**. Continuous horizontal bottom rail connecting all spindles. The spindles terminate into this rail.`;
                    } else {
                        // CASE 2: DIRECT MOUNT REQUIRED
                        mountingInstructionStep = `2.  **Mounting (DIRECT MOUNT):** The user requires **Direct Mount**. Each post base mounts directly into the stair tread/floor with a base plate.`;
                    }
                }

                // POST-TO-RAIL REDUCER SPECIFICATION (Strictly toggle-controlled):
                if (specs.hasReducers !== undefined && specs.hasReducers !== null) {
                    if (specs.hasReducers === true) {
                        reducerInstructionStep = `3.  **POST-TO-RAIL JUNCTION (REDUCER FITTINGS REQUIRED):**
- The style requires reducer fittings: Pay extra close attention to the post-to-rail connection point in both **IMAGE B** and **IMAGE C**.
- Posts connect to the top rail using post-top stem reducers / transition collars at the top of each post.`;
                    } else {
                        reducerInstructionStep = `2.  **POST-TO-RAIL JOINT (DIRECT SEAMLESS WELD):**
- Exactly match the seamless joint shown in **IMAGE B** and **IMAGE C**.
- Every square post (including the bottom newel post, intermediate stair posts, and landing posts) is a single continuous tube that reaches all the way to touch the underside of the top handrail.
- The top of each square post meets the handrail directly with the handrail resting directly on top of each post. Direct solid metal-to-metal fusion throughout.
- There is zero space, zero gap, and zero connecting pin between the post and the handrail; the two pieces of metal are welded directly together into a single continuous solid joint.`;
                    }
                }

                if (specs.description && specs.description.trim()) {
                    styleSpecsStep = `\n    **STYLE SPECIFICATIONS:** ${specs.description.trim()}`;
                }

                if (specs.customNote && specs.customNote.trim()) {
                    customNoteStep = `\n    **ADMIN/TEST DIRECTIVE (STRICT OVERRIDE):** ${specs.customNote.trim()}`;
                }
            }

            // 3. User Prompt construction
            let promptText = promptConfig?.userTemplate || `[INPUTS]
: **IMAGE A (Canvas):** [User's Staircase]
: **IMAGE B (Primary Style):** [Primary Style Reference]
: **IMAGE C (Detailed Context References):** [Extra Context & Detailed References]

***

### PHASE 1: DIAGNOSTIC & DEMOLITION (IMAGE A)
Analyze the User's Staircase.
1.  **Existing Rail Check:** Is there an existing handrail?
    - **YES:** Create a precise mask around it. DIGITALLY REMOVE IT. "Heal" the background (fill holes in steps, fix drywall, match wall texture) so it looks like an empty staircase.
    - **NO:** Proceed immediately to Phase 2.
2.  **Geometry Check:** Trace the "Nosing Line" (tips of the treads). Your new rail must follow this path. Confirm the start and end points (floor or wall?).
3.  **Layout Strategy:** Analyze the width and context.
    - **Single vs Double:** Is the stair open on one side (Single) or both sides (Double)?
    - **Wall Rail:** Is the stair enclosed by walls? If so, does it need a wall-mounted handrail instead of a post-to-post system?
    - *Decision:* Choose the layout that maximizes safety and matches the architectural style of Image A.

### PHASE 2: STYLE & MOUNTING EXECUTION
Apply **IMAGE B (Primary Style)**, **IMAGE C (Detailed Context References)**, and **TECHNICAL SPECS**.
1.  **Mounting & Junction Logic:**
    ${mountingInstructionStep}
    ${reducerInstructionStep ? `\n    ${reducerInstructionStep}` : ''}
2.  **Materials & Fabrication:** Extract the exact materials, finishes, and fabrication methods from **IMAGE B** and **IMAGE C**. Apply this texture and detail to your new model.${styleSpecsStep}
3.  **Preservation:** DO NOT CHANGE THE STAIRS, WALLS, OR FLOORING of Image A (except for the healed areas from Phase 1).

### PHASE 3: EXECUTION
Renovate **IMAGE A**.
1.  **Install:** Generate the new system defined in Phase 2 onto the path defined in Phase 1.
2.  **Physics:** Ensure correct shadows and lighting match Image A.
3.  **Preservation:** DO NOT CHANGE THE STAIRS, WALLS, OR FLOORING of Image A (except for the healed areas from Phase 1).

**FINAL CHECK:**
- Is the old rail gone?
- Is the new rail mounting (Shoe vs Direct) correct according to Image B and Image C?
- Did you examine the post-to-rail junction in Image B and Image C and follow the connection specification?
- Is the background preserved?`;

            // If user has a custom template that includes placeholders, replace them.
            if (promptText.includes('{{mounting_logic}}')) {
                promptText = promptText.replace('{{mounting_logic}}', mountingInstructionStep);
            }
            if (promptText.includes('{{reducers_logic}}') || promptText.includes('{{reducer_logic}}')) {
                promptText = promptText.replace(/\{\{reducers?_logic\}\}/g, reducerInstructionStep);
            }
            if (promptText.includes('{{material_specs}}') || promptText.includes('{{description}}')) {
                promptText = promptText.replace(/\{\{(material_specs|description)\}\}/g, styleSpecsStep);
            }

            const styleDesc = typeof styleInput === 'string' ? styleInput : "The attached Style Reference Images";
            if (promptText.includes('{{style}}')) {
                promptText = promptText.replace('{{style}}', styleDesc);
            } else if (typeof styleInput === 'string') {
                promptText += `\n\nTarget Style Description: "${styleInput}"`;
            }

            // CRITICAL FABRICATION OVERRIDES (Ensure these are never dropped regardless of template used)
            const overrides: string[] = [];
            if (!promptText.includes(mountingInstructionStep) && mountingInstructionStep !== "2.  **Analysis:** Extract the Style (Material) and Mounting Tech (Shoe vs Direct) from Layer 2.") {
                overrides.push(mountingInstructionStep);
            }
            if (reducerInstructionStep && !promptText.includes(reducerInstructionStep)) {
                overrides.push(reducerInstructionStep);
            }

            if (overrides.length > 0) {
                promptText += `\n\n**CRITICAL FABRICATION OVERRIDES:**\n${overrides.map(o => `- ${o}`).join('\n')}`;
            }

            if (styleSpecsStep && !promptText.includes(styleSpecsStep)) {
                promptText += `\n\n${styleSpecsStep.trim()}`;
            }

            if (customNoteStep) {
                promptText += `\n\n${customNoteStep.trim()}`;
            }



            // Negative Constraints (keep only clean user-defined negative prompt, no keyword dumping)
            let combinedNegative = (promptConfig?.negative_prompt || "").trim();
            if (combinedNegative) {
                promptText += `\n\nNEGATIVE CONSTRAINTS (STRICTLY PROHIBITED): ${combinedNegative}`;
            }

            parts.push({ text: promptText });

            console.log('--- FINAL PROMPT SENT TO VERTEX ---');
            console.log(promptText);
            console.log('--- END PROMPT ---');



            // BYPASS SDK: Use Raw Fetch because SDK fails on Gemini 3 'thought' responses (JSON parsing error)
            const authOptions = getGoogleAuthOptions();
            const token = await getAccessToken(authOptions.credentials?.client_email, authOptions.credentials?.private_key);
            const projectId = authOptions.projectId || process.env.VERTEX_PROJECT_ID || 'railvision-480923';

            const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/gemini-3.1-flash-image:generateContent`;

            console.log(`[VERTEX RAW] Calling URL: ${url}`);

            const rawResponse = await withTimeout(fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{ text: finalSystemInstruction }]
                    },
                    contents: [{ role: 'user', parts }],
                    generationConfig: {
                        temperature: 0.4,
                        maxOutputTokens: 2048
                    }
                })
            }), 120000, 'Vertex AI Generation Timed Out (120s)');

            if (!rawResponse.ok) {
                const text = await rawResponse.text();
                throw new Error(`Vertex API Error ${rawResponse.status}: ${text}`);
            }

            const responseJson = await rawResponse.json();

            // Usage extraction
            const usage = {
                inputTokens: responseJson.usageMetadata?.promptTokenCount || 0,
                outputTokens: responseJson.usageMetadata?.candidatesTokenCount || 0
            };

            const candidate = responseJson.candidates?.[0];
            if (!candidate) throw new Error("No candidates returned");

            for (const part of candidate.content.parts) {
                // Handle "Thought" parts vs "Image" parts
                if (part.thought) {
                    console.log(`[GEMINI THOUGHT] ${part.text?.substring(0, 50)}...`);
                    continue;
                }

                // Check for Inline Data (Base64 Image)
                if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
                    return {
                        success: true,
                        image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                        usage
                    };
                }

                // Fallback: Check if text contains an image url (improbable for this model but good safety)
            }

            return { success: false, error: "Model returned text/thoughts instead of image." };

        } catch (error: any) {
            console.error(`[NANO BANANA ERROR] Attempt ${attempts + 1} failed:`, error);

            const isQuotaError =
                error.message?.includes('429') ||
                error.message?.includes('Quota') ||
                error.message?.includes('Too Many Requests') ||
                error.message?.includes('Resource exhausted') ||
                error.message?.includes('503') ||
                error.message?.includes('Service Unavailable') ||
                error.code === 429 ||
                error.code === 503;

            if (isQuotaError) {
                attempts++;
                if (attempts < maxAttempts) {
                    // Exponential Backoff:
                    // Attempt 1 (attempts=1): 2000 * 2^0 = 2000ms
                    // Attempt 2 (attempts=2): 2000 * 2^1 = 4000ms
                    // Attempt 3 (attempts=3): 2000 * 2^2 = 8000ms
                    // Attempt 4 (attempts=4): 2000 * 2^3 = 16000ms

                    const baseDelay = 2000 * Math.pow(2, attempts - 1);
                    const jitter = Math.floor(Math.random() * 500); // 0-500ms jitter
                    const waitTime = baseDelay + jitter;

                    console.warn(`[VERTEX RETRY] Quota/Service hit. Waiting ${waitTime}ms (Attempt ${attempts} of ${maxAttempts} remaining)...`);
                    await sleep(waitTime);
                    continue;
                }
            }
            return { success: false, error: error.message || "Unknown error during Nano Banana generation" };
        }
    }

    return { success: false, error: "Server is busy, please try again in 1 minute." };
}

// Helper for timeout
function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage = 'Operation timed out'): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms))
    ]);
}

export { getRouterModel, getImagenModel };
