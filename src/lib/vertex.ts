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
            const credsStr = process.env.GOOGLE_APPLICATION_CREDENTIALS;
            const isBase64 = !credsStr.trim().startsWith('{');
            const jsonStr = isBase64 ? Buffer.from(credsStr, 'base64').toString('utf-8') : credsStr;
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
            model: 'gemini-1.5-flash-002'
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

export async function generateDesignWithNanoBanana(
    base64TargetImage: string,
    styleInput: string | { base64StyleImages: string[] },
    promptConfig?: { systemInstruction: string; userTemplate: string; negative_prompt?: string }
): Promise<{ success: boolean; image?: string; error?: string; usage?: { inputTokens: number; outputTokens: number } }> {
    const maxAttempts = 3;
    let attempts = 0;

    // Use lazy getter for the model
    let model;
    try {
        const client = await getVertexClient(true); // Restore usage of Global Client for Nano Banana
        const finalSystemInstruction = promptConfig?.systemInstruction || `**ROLE:** You are Railify-AI, an expert Architectural Visualization Engine. Your goal is to renovate staircases with photorealistic accuracy and strict adherence to construction physics.

**THE TRUTH HIERARCHY (CRITICAL):**
You will receive input images. You must prioritize their data in this specific order:
1.  **IMAGE C (Specs):** The **Physics Truth**. This is the construction blueprint. Its text labels and connection details are ABSOLUTE LAWS.
2.  **IMAGE A (Canvas):** The **Geometry Truth**. The existing stair pitch, tread count, walls, flooring, and lighting are IMMUTABLE. You are a layer on top; do not warp the house.
3.  **IMAGE B (Style):** The **Texture Truth**. Use this only for material surface qualities (color, reflectivity, finish).

**PHYSICS ENGINE:**
*   **Gravity:** Handrails must follow the "Nosing Line" (tips of the treads) perfectly.
*   **Shadows:** New rails must cast shadows consistent with the light sources visible in Image A.
*   **Occlusion:** If a rail passes behind a wall or furniture in Image A, you must mask it correctly.

**MOUNTING LOGIC (THE "SHOE" TEST):**
*   **Shoe Rail:** Vertical balusters connect to a horizontal bottom bar.
*   **Direct-Mount:** Vertical balusters drill INDIVIDUALLY into the stair tread.
*   **CONSTRAINT:** In Direct-Mount mode, the space *between* pickets at the floor level must be empty air. Drawing a bottom horizontal bar is FORBIDDEN.

**OUTPUT GOAL:** A single, high-fidelity renovation of Image A.`;

        console.log('--- SYSTEM INSTRUCTION ---');
        console.log(finalSystemInstruction);
        console.log('--- END SYSTEM INSTRUCTION ---');

        model = client.getGenerativeModel({
            model: 'gemini-3-pro-image-preview', // Restore User's Required Model
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
                    parts.push({ text: "**IMAGE B (Style):** The aesthetic reference (Style Guide)." });
                    parts.push({
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: styleImages[0]
                        }
                    });

                    if (styleImages.length > 1) {
                        parts.push({ text: "**IMAGE C (Specs):** Technical details and mounting logic." });
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

            // 3. User Prompt construction
            let promptText = promptConfig?.userTemplate || `[INPUTS]
: **IMAGE A (Canvas):** [User's Staircase]
: **IMAGE B (Style):** [Style Reference]
: **IMAGE C (Specs):** [The Tech Sheet]

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

### PHASE 2: STYLE & MOUNTING ANALYSIS (IMAGE B & C)
Inspect **IMAGE B (Style)** and **IMAGE C (Specs)** for construction rules.
1.  **Mounting Type:** Look closely at the bottom of the balusters (spindles).
    - **Shoe Rail:** Do they sit on a bottom horizontal rail?
    - **Direct Mount:** Do they go directly into the floor/tread?
    - *CRITICAL INSTRUCTION:* If "Direct Mount", you must NOT draw a bottom bar. Each spindle must touch the floor individually.
2.  **Materials:** Extract the exact wood stain, metal finish, or glass type from **IMAGE B**. Apply this texture to your new model.

### PHASE 3: EXECUTION
Renovate **IMAGE A**.
1.  **Install:** Generate the new system defined in Phase 2 onto the path defined in Phase 1.
2.  **Physics:** Ensure correct shadows and lighting match Image A.
3.  **Preservation:** DO NOT CHANGE THE STAIRS, WALLS, OR FLOORING of Image A (except for the healed areas from Phase 1).

**FINAL CHECK:**
- Is the old rail gone?
- Is the new rail mounting (Shoe vs Direct) correct according to Image B?
- Is the background preserved?`;

            const styleDesc = typeof styleInput === 'string' ? styleInput : "The attached Style Reference Images";
            if (promptText.includes('{{style}}')) {
                promptText = promptText.replace('{{style}}', styleDesc);
            } else if (typeof styleInput === 'string') {
                promptText += `\n\nTarget Style Description: "${styleInput}"`;
            }

            if (promptConfig?.negative_prompt) {
                promptText += `\n\nNEGATIVE CONSTRAINTS: ${promptConfig.negative_prompt}`;
            }

            parts.push({ text: promptText });

            console.log('--- FINAL PROMPT SENT TO VERTEX ---');
            console.log(promptText);
            console.log('--- END PROMPT ---');

            console.log('--- FINAL PROMPT SENT TO VERTEX ---');
            console.log(promptText);
            console.log('--- END PROMPT ---');

            // BYPASS SDK: Use Raw Fetch because SDK fails on Gemini 3 'thought' responses (JSON parsing error)
            const authOptions = getGoogleAuthOptions();
            const token = await getAccessToken(authOptions.credentials?.client_email, authOptions.credentials?.private_key);
            const projectId = authOptions.projectId || process.env.VERTEX_PROJECT_ID || 'railvision-480923';

            const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/gemini-3-pro-image-preview:generateContent`;

            console.log(`[VERTEX RAW] Calling URL: ${url}`);

            const rawResponse = await withTimeout(fetch(url, {
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
            if (error.message?.includes('429') || error.message?.includes('Quota') || error.message?.includes('Too Many Requests') || error.code === 429) {
                attempts++;
                if (attempts < maxAttempts) {
                    const waitTime = 1000 * Math.pow(2, attempts - 1);
                    console.warn(`[429 RATE LIMIT] Retrying in ${waitTime}ms...`);
                    await sleep(waitTime);
                    continue;
                }
            }
            return { success: false, error: error.message || "Unknown error during Nano Banana generation" };
        }
    }

    return { success: false, error: "Max retries exceeded." };
}

// Helper for timeout
function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage = 'Operation timed out'): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms))
    ]);
}

export { getRouterModel, getImagenModel };
