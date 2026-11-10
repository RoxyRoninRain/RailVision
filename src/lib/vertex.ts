import fs from 'fs';
import { SECOND_PASS_ISSUES } from '@/app/actions/types';
import { detectImageMetadata, type SupportedAspectRatio } from '@/lib/validations';

// STRICT LAZY LOAD: Do NOT import types from @google-cloud/vertexai at top level
// This prevents the build system from trying to resolve the module during static analysis.

// Singleton instances (typed as any to avoid top-level import)
let vertexAI: any = null;
let vertexAIGlobal: any = null;
let routerModel: any = null;
let imagenModel: any = null;

const FALLBACK_IMAGE_MODEL = 'gemini-3.1-flash-image';

export function getConfiguredImageModelId(): string {
    const envModel = process.env.VERTEX_IMAGE_MODEL?.trim();
    return envModel || FALLBACK_IMAGE_MODEL;
}

/**
 * Strips any `data:image/...;base64,` prefix, detects genuine binary MIME type
 * (JPEG, PNG, WebP) and pixel aspect ratio so Vertex AI receives accurate decoder
 * metadata and preserves the input staircase framing.
 */
export function parseBase64ImagePart(base64OrDataUri: string): {
    cleanBase64: string;
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
    aspectRatio?: SupportedAspectRatio;
} {
    let explicitMime: 'image/jpeg' | 'image/png' | 'image/webp' | undefined;
    let cleanBase64 = base64OrDataUri;

    if (base64OrDataUri.startsWith('data:')) {
        const commaIdx = base64OrDataUri.indexOf(',');
        if (commaIdx !== -1) {
            const header = base64OrDataUri.slice(0, commaIdx).toLowerCase();
            if (header.includes('image/png')) explicitMime = 'image/png';
            else if (header.includes('image/webp')) explicitMime = 'image/webp';
            else if (header.includes('image/jpeg') || header.includes('image/jpg')) explicitMime = 'image/jpeg';
            cleanBase64 = base64OrDataUri.slice(commaIdx + 1);
        }
    }

    try {
        const buf = Buffer.from(cleanBase64, 'base64');
        const meta = detectImageMetadata(buf);
        if (meta.valid && meta.mimeType && meta.mimeType !== 'image/heic') {
            return {
                cleanBase64,
                mimeType: meta.mimeType,
                aspectRatio: meta.aspectRatio,
            };
        }
    } catch {
        // Fallback for synthetic unit-test strings
    }

    return {
        cleanBase64,
        mimeType: explicitMime || 'image/jpeg',
    };
}

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

const DEFAULT_SYSTEM_INSTRUCTION = `**ROLE:** You are Railify-AI, an expert Architectural Visualization & Metal Fabrication Inpainting Engine.
**TASK:** Renovate ONLY the handrail/railing system in **IMAGE A** while keeping 100% of the surrounding staircase, room architecture, decor, lighting, and camera geometry identical to **IMAGE A**.

**DATA LAYERS (STRICT SEPARATION):**
**LAYER 1: THE SCENE CANVAS (IMAGE A — IMMUTABLE ENVIRONMENT)**
*   **Status:** PIXEL-LOCKED BACKGROUND. Every stair tread, riser, stringer, nosing count, wall, baseboard, trim molding, window, door, light fixture, rug, plant, decor item, and piece of furniture outside the handrail footprint is **READ-ONLY** and must remain untouched.
*   **Foreground Occlusion:** If a foreground half-wall, column, drywall return, or stair stringer naturally overlaps the railing path in Image A, preserve that exact foreground occlusion in front of the new railing.

**LAYER 2: THE PRODUCT SPECIMEN (IMAGE B / IMAGE C — HARDWARE ONLY)**
*   **Status:** PRODUCT & HARDWARE REFERENCE ONLY.
*   **Style-Scene Isolation:** Extract ONLY the railing product (top-rail profile, post cross-section thickness, infill geometry/spacing, metal/wood/cable/glass finish, and mounting hardware) from Image B/C. Completely ignore the walls, stairs, wood species, outdoor scenery, and lighting of Image B/C—never transfer Image B's room into Image A.
*   **Architectural Scale & Code Proportions:**
    *   Set the top handrail at authentic residential scale (~34–38 inches vertically above the stair tread nosing line), running strictly parallel to the stair pitch without bowing or sagging.
    *   Keep vertical posts strictly plumb (vertical to gravity) with consistent cross-section thickness matching Image B/C, and keep balusters/cables evenly spaced (<4 inch code spacing).
    *   Terminate top and bottom rail ends cleanly into structural newel posts, wall returns, or end caps matching Image B—never leave rail ends floating mid-air.

**OUTPUT FORMAT:**
*   Single unified, photorealistic photograph matching the exact camera POV, lens focal length, and aspect ratio of Image A.
*   Output ONLY the final photograph with zero visible text overlays or captions.`;

export async function generateDesignWithNanoBanana(
    base64TargetImage: string,
    styleInput: string | { 
        base64StyleImages: string[]; 
        technicalSpecs?: { 
            hasBottomRail?: boolean; 
            hasReducers?: boolean | null; 
            postMount?: 'top' | 'side' | string;
            description?: string; 
            customNote?: string; 
        } 
    },
    promptConfig?: { systemInstruction: string; userTemplate: string; negative_prompt?: string }
): Promise<{ success: boolean; image?: string; error?: string; modelUsed?: string; usage?: { inputTokens: number; outputTokens: number } }> {
    const maxAttempts = 5;
    let attempts = 0;
    let activeModelId = getConfiguredImageModelId();
    let disableImageConfig = false;

    // Use lazy getter for the model
    let finalSystemInstruction = '';
    try {
        const client = await getVertexClient(true); // Restore usage of Global Client for Nano Banana
        const baseSystemInstruction = (promptConfig?.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION)
            .replace('{{DATE}}', new Date().toISOString().split('T')[0]);

        finalSystemInstruction = baseSystemInstruction;

        if (process.env.NODE_ENV !== 'production') {
            console.log('--- SYSTEM INSTRUCTION ---');
            console.log(finalSystemInstruction);
            console.log('--- END SYSTEM INSTRUCTION ---');
        }

        client.getGenerativeModel({
            model: activeModelId,
            systemInstruction: finalSystemInstruction
        });

        console.log(`[VERTEX] Initialized generation pipeline (model: ${activeModelId})...`);

    } catch (e) {
        console.warn("[VERTEX] Lazily init failed:", e);
        return { success: false, error: "AI Service Unavailable: Initialization Failed" };
    }

    const targetPartMeta = parseBase64ImagePart(base64TargetImage);

    while (attempts < maxAttempts) {
        try {
            console.log(`[NANO BANANA] Generation attempt ${attempts + 1} of ${maxAttempts} (${activeModelId})...`);

            const parts: any[] = [];

            // 1. Target Image (Image A)
            parts.push({
                text: `**IMAGE A (Immutable Scene Canvas${targetPartMeta.aspectRatio ? ` — Aspect Ratio ${targetPartMeta.aspectRatio}` : ''}):** The user's original staircase. Preserve all room architecture, tread count, walls, flooring, lighting, and camera POV.`
            });
            parts.push({
                inlineData: {
                    mimeType: targetPartMeta.mimeType,
                    data: targetPartMeta.cleanBase64
                }
            });

            // 2. Style Images (Image B & C)
            const hasExtraStyleRefs = typeof styleInput !== 'string' && styleInput.base64StyleImages.length > 1;
            if (typeof styleInput === 'string') {
                console.log('[DEBUG] Text-only style, skipping Image B/C slots');
            } else {
                const styleImages = styleInput.base64StyleImages;
                if (styleImages.length > 0) {
                    const primaryStyleMeta = parseBase64ImagePart(styleImages[0]);
                    parts.push({
                        text: "**IMAGE B (Primary Railing Specimen — Extract Hardware & Style Only, Ignore Room Background):** The primary railing design, profile dimensions, and finish reference."
                    });
                    parts.push({
                        inlineData: {
                            mimeType: primaryStyleMeta.mimeType,
                            data: primaryStyleMeta.cleanBase64
                        }
                    });

                    if (hasExtraStyleRefs) {
                        parts.push({
                            text: "**IMAGE C (Detailed Hardware & Fabrication Close-Ups — Ignore Background):** Additional reference photos showing exact joints, post mounting hardware, and construction details."
                        });
                        for (let i = 1; i < styleImages.length; i++) {
                            const refMeta = parseBase64ImagePart(styleImages[i]);
                            parts.push({
                                inlineData: {
                                    mimeType: refMeta.mimeType,
                                    data: refMeta.cleanBase64
                                }
                            });
                        }
                    }
                }
            }

            const refLabelText = hasExtraStyleRefs ? '**IMAGE B** and **IMAGE C**' : '**IMAGE B**';

            // DYNAMIC FABRICATION & MOUNTING INSTRUCTIONS
            let mountingInstructionStep = `1a. **Analysis:** Extract the Style (Material, Post Profile, Infill Spacing) and Mounting Tech (Shoe Rail vs Direct Tread Mount) from ${refLabelText}.`; // Default generic fallback
            let postMountInstructionStep = "";
            let reducerInstructionStep = "";
            let styleSpecsStep = "";
            let customNoteStep = "";

            if (typeof styleInput !== 'string' && styleInput.technicalSpecs) {
                const specs = styleInput.technicalSpecs as any;
                if (specs.hasBottomRail !== undefined && specs.hasBottomRail !== null) {
                    if (specs.hasBottomRail) {
                        // CASE 1: SHOE RAIL REQUIRED
                        mountingInstructionStep = `1a. **Mounting (SHOE RAIL REQUIRED):** The user requires a **Shoe Rail**. Render a continuous horizontal bottom rail running parallel to the stair pitch 2–4 inches above the stair nosing line connecting all spindles. All intermediate spindles must terminate cleanly into the top surface of this bottom rail, leaving open air between the underside of the shoe rail and the stair treads.`;
                    } else {
                        // CASE 2: DIRECT MOUNT REQUIRED
                        mountingInstructionStep = `1a. **Mounting (DIRECT MOUNT - NO BOTTOM RAIL):** The user requires **Direct Mount**. Each post/spindle extends all the way down to anchor directly into its individual stair tread or landing floor with clean bare tread surface between spindles (no parallel lower shoe rail above the stair nosings).`;
                    }
                }

                // POST MOUNTING SPECIFICATION (Side mount vs Top mount):
                if (specs.postMount) {
                    if (specs.postMount === 'side') {
                        postMountInstructionStep = `1b. **POST MOUNTING (SIDE / FASCIA MOUNT - DIRECT 2-BOLT ATTACHMENT, NO PLATES):**
- The user requires **Side Mount (Fascia Mount)** posts.
- Inspect **IMAGE C** closely for the exact post-to-stringer mounting detail.
- **DIRECT 2-BOLT FASTENING:** Every post (bottom newel, intermediate stair posts, and landing posts) must mount directly flat against the outer side face / exterior stringer / side fascia of the staircase using **2 through-bolts (vertically stacked)** passing directly through the post body into the wood stringer or deck rim joist.
- **STRICTLY NO MOUNTING PLATES OR BRACKETS:** Do NOT generate mounting plates, bracket collars, standoff saddles, or external mounting tabs. The post tube/bar must sit directly flat against the stringer face with only the 2 bolt heads visible, exactly as shown in **IMAGE C**.
- Posts must extend downward along the outside edge of the stairs; do NOT mount post bases onto the top horizontal surface of the stair treads. Keep the tread walking surface completely open and clear of post bases.`;
                    } else if (specs.postMount === 'top') {
                        postMountInstructionStep = `1b. **POST MOUNTING (TOP / SURFACE MOUNT REQUIRED):**
- The user requires **Top Mount (Surface Mount)** posts.
- Every post base must mount directly onto the top horizontal surface of the stair treads or landing floor using surface-mounted base plates / flange shoes anchored vertically down into the tread/deck floor.
- Posts must stand upright directly on top of the steps or landing flooring, NOT attached to the exterior side fascia or outer stringer edge.`;
                    }
                }

                // POST-TO-RAIL REDUCER SPECIFICATION (Strictly toggle-controlled):
                if (specs.hasReducers !== undefined && specs.hasReducers !== null) {
                    if (specs.hasReducers === true) {
                        reducerInstructionStep = `1c. **POST-TO-RAIL JUNCTION (REDUCER FITTINGS REQUIRED):**
- The style requires reducer fittings: Pay extra close attention to the post-to-rail connection point in both **IMAGE B** and **IMAGE C**.
- Posts connect to the top rail using post-top stem reducers / transition collars at the top of each post.`;
                    } else {
                        reducerInstructionStep = `1c. **POST-TO-RAIL JOINT (DIRECT SEAMLESS WELD):**
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
: **IMAGE A (Canvas):** [User's Staircase — Immutable Scene & Camera]
: **IMAGE B (Primary Style):** [Primary Railing Product Specimen]${hasExtraStyleRefs ? `\n: **IMAGE C (Detailed Context References):** [Close-Up Hardware & Fabrication References]` : ''}

***

### PHASE 1: SEMANTIC MASKING & DEMOLITION (IMAGE A)
Analyze the User's Staircase in **IMAGE A**:
1.  **Existing Railing Removal:** Locate ONLY the existing handrail, balusters/spindles, newel posts, and wall brackets in Image A.
    - **If an existing railing is present:** Digitally remove it completely and seamlessly reconstruct the occluded stair tread wood/carpet, nosings, risers, stringer face, and wall paint behind it using the exact surrounding textures of Image A.
    - **If no railing is present:** Keep every surface of Image A as-is and proceed to Phase 2.
2.  **Geometric Anchor Path:** Trace the exact 3D **Nosing Line** (leading edges of every stair tread and landing in Image A). Count the exact treads and landings so zero steps are added, removed, or shifted.
3.  **Run & Layout Selection:**
    - Install the new railing only along open stair edges, landings/balconies, or existing handrail runs visible in Image A.
    - If a staircase run is fully enclosed between two solid drywall walls with no open edge, install a matching wall-mounted handrail along the wall path rather than freestanding posts on enclosed steps.

### PHASE 2: PRODUCT & HARDWARE SYNTHESIS
Extract ONLY the railing hardware and finish from ${refLabelText} (completely ignoring ${refLabelText}'s room background):
1.  **Mounting & Junction Logic:**
    ${mountingInstructionStep}
    ${postMountInstructionStep ? `\n    ${postMountInstructionStep}` : ''}
    ${reducerInstructionStep ? `\n    ${reducerInstructionStep}` : ''}
2.  **Materials, Proportions & Scale:** Replicate the exact metal/wood/cable/glass finish, post cross-section thickness, top-rail profile, and uniform <4-inch infill spacing from ${refLabelText}. Set the top handrail height at a realistic 34–38 inches above the stair nosing line.${styleSpecsStep}
3.  **Strict Environment Lock:** Keep all walls, stair treads, flooring, windows, doors, lighting fixtures, and room decor from Image A 100% unchanged.

### PHASE 3: PHOTOREALISTIC COMPOSITING
Render the renovated **IMAGE A**:
1.  **Perspective & Occlusion:** Match Image A's exact camera focal length, vanishing points, and foreground wall/column occlusions.
2.  **Lighting & Contact Shadows:** Cast physically accurate contact shadows and metallic reflections driven strictly by Image A's existing light sources.

**FINAL VERIFICATION:**
- Is the old handrail completely gone with zero leftover wooden/iron stubs or ghosted holes?
- Does the new railing strictly match the Shoe Rail vs Direct Mount, Side Mount vs Top Mount, and Post-to-Rail Joint specifications?
- Are every stair step, wall, window, piece of furniture, and camera angle pixel-faithful to Image A?`;

            // If user has a custom template that includes placeholders, replace them.
            if (promptText.includes('{{mounting_logic}}')) {
                promptText = promptText.replace('{{mounting_logic}}', mountingInstructionStep);
            }
            if (promptText.includes('{{post_mount_logic}}') || promptText.includes('{{post_mount}}')) {
                promptText = promptText.replace(/\{\{(post_mount_logic|post_mount)\}\}/g, postMountInstructionStep);
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
            if (!promptText.includes(mountingInstructionStep) && !mountingInstructionStep.startsWith("1a. **Analysis:**")) {
                overrides.push(mountingInstructionStep);
            }
            if (postMountInstructionStep && !promptText.includes(postMountInstructionStep)) {
                overrides.push(postMountInstructionStep);
            }
            if (reducerInstructionStep && !promptText.includes(reducerInstructionStep)) {
                overrides.push(reducerInstructionStep);
            }

            if (overrides.length > 0) {
                promptText += `\n\n**CRITICAL FABRICATION OVERRIDES (HIGHEST PRIORITY - SUPERSEDES ANY CONFLICTING DEFAULTS ABOVE):**\n${overrides.map(o => `- ${o}`).join('\n')}`;
            }

            if (styleSpecsStep && !promptText.includes(styleSpecsStep)) {
                promptText += `\n\n${styleSpecsStep.trim()}`;
            }

            if (customNoteStep) {
                promptText += `\n\n${customNoteStep.trim()}`;
            }

            // Negative Constraints (keep only clean user-defined negative prompt, no keyword dumping)
            const combinedNegative = (promptConfig?.negative_prompt || "").trim();
            if (combinedNegative) {
                promptText += `\n\nNEGATIVE CONSTRAINTS (STRICTLY PROHIBITED): ${combinedNegative}`;
            }

            parts.push({ text: promptText });

            if (process.env.NODE_ENV !== 'production') {
                console.log('--- FINAL PROMPT SENT TO VERTEX ---');
                console.log(promptText);
                console.log('--- END PROMPT ---');
            }

            // BYPASS SDK: Use Raw Fetch because legacy @google-cloud/vertexai SDK fails on Gemini 3 'thought' parts
            const authOptions = getGoogleAuthOptions();
            const token = await getAccessToken(authOptions.credentials?.client_email, authOptions.credentials?.private_key);
            const projectId = authOptions.projectId || process.env.VERTEX_PROJECT_ID;
            if (!projectId && process.env.NODE_ENV === 'production') {
                throw new Error('Missing VERTEX_PROJECT_ID configuration');
            }
            const resolvedProjectId = projectId || 'railvision-480923';

            const url = `https://aiplatform.googleapis.com/v1/projects/${resolvedProjectId}/locations/global/publishers/google/models/${activeModelId}:generateContent`;

            const attemptTemp = Math.max(0.15, 0.35 - attempts * 0.1);
            const generationConfig: Record<string, any> = {
                temperature: attemptTemp,
                // 8192 provides ample headroom for internal Gemini thinking tokens + 1K/2K image output tokens
                maxOutputTokens: 8192,
            };

            if (!disableImageConfig && targetPartMeta.aspectRatio) {
                generationConfig.imageConfig = {
                    aspectRatio: targetPartMeta.aspectRatio,
                };
            }

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
                    generationConfig
                })
            }), 120000, 'Vertex AI Generation Timed Out (120s)');

            if (!rawResponse.ok) {
                const text = await rawResponse.text();
                // Graceful fallback if configured VERTEX_IMAGE_MODEL is not yet enabled in the GCP project
                if (rawResponse.status === 404 && activeModelId !== FALLBACK_IMAGE_MODEL) {
                    console.warn(`[VERTEX] Model ${activeModelId} returned 404; falling back to ${FALLBACK_IMAGE_MODEL}`);
                    activeModelId = FALLBACK_IMAGE_MODEL;
                    continue;
                }
                // Graceful retry if endpoint rejects imageConfig payload field
                if (rawResponse.status === 400 && !disableImageConfig && generationConfig.imageConfig) {
                    console.warn('[VERTEX] Retrying without generationConfig.imageConfig after 400 response');
                    disableImageConfig = true;
                    continue;
                }
                throw new Error(`Vertex API Error ${rawResponse.status}: ${text}`);
            }

            const responseJson = await rawResponse.json();

            // Usage extraction
            const usage = {
                inputTokens: responseJson.usageMetadata?.promptTokenCount || 0,
                outputTokens: responseJson.usageMetadata?.candidatesTokenCount || 0
            };

            const candidate = responseJson.candidates?.[0];
            if (!candidate || !candidate.content?.parts) throw new Error("No candidates returned");

            for (const part of candidate.content.parts) {
                // Handle "Thought" parts vs "Image" parts
                if (part.thought) {
                    continue;
                }

                // Check for Inline Data (Base64 Image)
                if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
                    return {
                        success: true,
                        image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                        modelUsed: activeModelId,
                        usage
                    };
                }
            }

            throw new Error("Model returned text/thoughts instead of image.");

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

            const isTextOnlyResponse =
                error.message?.includes('Model returned text/thoughts instead of image') ||
                error.message?.includes('No candidates returned');

            if (isQuotaError || (isTextOnlyResponse && attempts < 2)) {
                attempts++;
                if (attempts < maxAttempts) {
                    const baseDelay = isTextOnlyResponse ? 1000 : 2000 * Math.pow(2, attempts - 1);
                    const jitter = Math.floor(Math.random() * 500);
                    const waitTime = baseDelay + jitter;

                    console.warn(`[VERTEX RETRY] ${isTextOnlyResponse ? 'Text-only response' : 'Quota/Service hit'}. Waiting ${waitTime}ms (Attempt ${attempts} of ${maxAttempts})...`);
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

export interface SecondPassDetailImage {
    targetId: string;
    label: string;
    base64Data: string;
}

export function assembleRefinementPrompt(config: { 
    targets?: string[]; 
    custom_prompt?: string; 
    post_mount?: 'top' | 'side';
    detail_images?: Record<string, string>;
}): string {
    const issues: string[] = [];
    const targets = [...(config.targets || [])];

    for (const targetId of targets) {
        const issue = SECOND_PASS_ISSUES.find(i => i.id === targetId);
        if (issue) {
            const hasDetailImg = !!config.detail_images?.[targetId];
            if (hasDetailImg) {
                issues.push(`* ${issue.prompt} (Refer to the attached CLOSE-UP REFERENCE for ${issue.uploadLabel} to replicate this exact physical appearance and fabrication detail)`);
            } else {
                issues.push(`* ${issue.prompt}`);
            }
        }
    }

    if (config.custom_prompt && config.custom_prompt.trim()) {
        issues.push(`* CUSTOM REFINEMENT: ${config.custom_prompt.trim()}`);
    }

    if (issues.length === 0) {
        return "";
    }

    return `Perform a targeted micro-refinement on this railing photograph.
Preserve the room, walls, stair treads, background, lighting, and general scene perspective exactly as shown.
When removing any unwanted mounting plates, brackets, or ghosted spindles, restore the underlying stair tread, nosing, stringer, or wall surface cleanly using the Original Staircase Background reference if provided (never re-introduce the demolished old railing from the original before-photo).
Apply the following specific fabrication enhancements:
${issues.join('\n')}
Output a single unified high-resolution photograph.`;
}

export async function refineDesignWithNanoBanana(
    base64Image: string,
    refinementPrompt: string,
    referenceImages?: string[],
    detailImages?: SecondPassDetailImage[],
    originalSceneBase64?: string
): Promise<{ success: boolean; image?: string; error?: string; usage?: { inputTokens: number; outputTokens: number } }> {
    const maxAttempts = 3;
    let attempts = 0;
    let activeModelId = getConfiguredImageModelId();
    let disableImageConfig = false;

    const canvasMeta = parseBase64ImagePart(base64Image);

    const systemInstruction = `**ROLE:** Architectural Image Refiner.
**TASK:** Perform a targeted micro-refinement on the provided handrail photograph according to the user instructions.
**STRICT PRESERVATION RULES:**
* Do NOT alter the room, stairs, walls, flooring, lighting, or camera POV.
* Keep all materials, stair treads, and overall composition intact.
* Modify ONLY the specific joints, connections, or details requested.
* When removing misplaced hardware, baseplates, or ghosted balusters, heal the exposed stair tread, nosing, or wall surface to match the bare surface textures in the Original Staircase Background reference—NEVER copy the old pre-renovation railing, balusters, or newels back into the scene.
* If close-up hardware or fabrication reference photos are provided, replicate their physical appearance and construction methods precisely onto the canvas railing while ignoring their backgrounds.
* RETURN ONLY THE REFINED PHOTOGRAPH.`;

    const parts: any[] = [
        { text: "**CANVAS TO REFINE:** Input railing photograph from Pass 1:" },
        {
            inlineData: {
                mimeType: canvasMeta.mimeType,
                data: canvasMeta.cleanBase64
            }
        }
    ];

    if (originalSceneBase64) {
        const sceneMeta = parseBase64ImagePart(originalSceneBase64);
        parts.push({
            text: "**ORIGINAL STAIRCASE BACKGROUND (BARE SURFACE TEXTURE REFERENCE ONLY):** Use this before-photo ONLY to sample authentic bare stair tread wood/carpet, nosings, stringers, or wall paint behind any misplaced plates, posts, or ghosted spindles you remove. CRITICAL: Ignore the old pre-renovation handrail in this before-photo—never copy old balusters, posts, or rails back onto the canvas."
        });
        parts.push({
            inlineData: {
                mimeType: sceneMeta.mimeType,
                data: sceneMeta.cleanBase64
            }
        });
    }

    if (detailImages && detailImages.length > 0) {
        for (const detail of detailImages) {
            const detailMeta = parseBase64ImagePart(detail.base64Data);
            parts.push({
                text: `**CLOSE-UP REFERENCE (${detail.label.toUpperCase()}):** Inspect this close-up photo showing the exact required fabrication and hardware detail. Replicate this exact physical appearance onto the canvas railing.`
            });
            parts.push({
                inlineData: {
                    mimeType: detailMeta.mimeType,
                    data: detailMeta.cleanBase64
                }
            });
        }
    }

    if (referenceImages && referenceImages.length > 0) {
        parts.push({ text: "**STYLE & HARDWARE CONTEXT REFERENCES (IGNORE BACKGROUNDS):** Inspect closely for connection hardware, post joints, and mounting details:" });
        for (const refImg of referenceImages.slice(0, 4)) {
            const refMeta = parseBase64ImagePart(refImg);
            parts.push({
                inlineData: {
                    mimeType: refMeta.mimeType,
                    data: refMeta.cleanBase64
                }
            });
        }
    }

    parts.push({ text: refinementPrompt });

    while (attempts < maxAttempts) {
        try {
            const authOptions = getGoogleAuthOptions();
            const token = await getAccessToken(authOptions.credentials?.client_email, authOptions.credentials?.private_key);
            const projectId = authOptions.projectId || process.env.VERTEX_PROJECT_ID || 'railvision-480923';

            const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${activeModelId}:generateContent`;

            const generationConfig: Record<string, any> = {
                temperature: 0.2,
                maxOutputTokens: 8192,
            };

            if (!disableImageConfig && canvasMeta.aspectRatio) {
                generationConfig.imageConfig = {
                    aspectRatio: canvasMeta.aspectRatio,
                };
            }

            const rawResponse = await withTimeout(fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{ text: systemInstruction }]
                    },
                    contents: [{ role: 'user', parts }],
                    generationConfig
                })
            }), 120000, 'Vertex AI Refinement Timed Out (120s)');

            if (!rawResponse.ok) {
                const text = await rawResponse.text();
                if (rawResponse.status === 404 && activeModelId !== FALLBACK_IMAGE_MODEL) {
                    activeModelId = FALLBACK_IMAGE_MODEL;
                    continue;
                }
                if (rawResponse.status === 400 && !disableImageConfig && generationConfig.imageConfig) {
                    disableImageConfig = true;
                    continue;
                }
                throw new Error(`Vertex Refinement API Error ${rawResponse.status}: ${text}`);
            }

            const responseJson = await rawResponse.json();

            const usage = {
                inputTokens: responseJson.usageMetadata?.promptTokenCount || 0,
                outputTokens: responseJson.usageMetadata?.candidatesTokenCount || 0
            };

            const candidate = responseJson.candidates?.[0];
            if (!candidate || !candidate.content?.parts) throw new Error("No candidates returned from refinement");

            for (const part of candidate.content.parts) {
                if (part.thought) continue;
                if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
                    return {
                        success: true,
                        image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                        usage
                    };
                }
            }

            throw new Error("Model returned no image during refinement.");

        } catch (error: any) {
            console.error(`[REFINEMENT ERROR] Attempt ${attempts + 1} failed:`, error);
            attempts++;
            if (attempts < maxAttempts) {
                await sleep(2000 * attempts);
                continue;
            }
            return { success: false, error: error.message || "Failed during second-pass refinement" };
        }
    }

    return { success: false, error: "Refinement server busy." };
}

export { getRouterModel, getImagenModel };
