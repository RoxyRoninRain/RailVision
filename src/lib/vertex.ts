import fs from 'fs';
import crypto from 'crypto';
import type { GoogleGenAIOptions } from '@google/genai';
import {
    FabricationCategory,
    FabricationSpec,
    SceneRouterAnalysis,
    SECOND_PASS_ISSUES,
    StyleSlotId,
    STYLE_PHOTO_SLOTS,
    VisionQaResult,
} from '@/app/actions/types';
import { detectImageMetadata, type SupportedAspectRatio } from '@/lib/validations';
import {
    buildCanonicalSpecimenPrompt,
    buildCleanPlateDemolitionPrompt,
    buildFabSpecExtractorPrompt,
    buildPhotoValidatorPrompt,
    buildRailingSynthesisPrompts,
    buildSceneRouterPrompt,
    buildVisionQaPrompt,
    DEFAULT_SYNTHESIS_SYSTEM_INSTRUCTION,
} from '@/lib/prompts';

// Lazy-loaded SDK singletons avoid static bundle/initialization issues during Next.js build.
let vertexAI: any = null;
let vertexAIGlobal: any = null;
let routerModel: any = null;
let genAIClient: any = null;

const FALLBACK_IMAGE_MODEL = 'gemini-nano-banana-2.1';
const LEGACY_FALLBACK_IMAGE_MODEL = 'gemini-3.1-flash-image';
const FALLBACK_VISION_MODEL = 'gemini-3.8-flash';

export type ImageThinkingLevel = 'MINIMAL' | 'MEDIUM' | 'HIGH';

export function getConfiguredImageModelId(): string {
    const envModel = process.env.VERTEX_IMAGE_MODEL?.trim();
    return envModel || FALLBACK_IMAGE_MODEL;
}

export function getConfiguredVisionModelId(): string {
    const envModel = process.env.VERTEX_VISION_MODEL?.trim();
    return envModel || FALLBACK_VISION_MODEL;
}

export function getConfiguredThinkingLevel(): ImageThinkingLevel {
    const raw = process.env.VERTEX_THINKING_LEVEL?.trim().toUpperCase();
    if (raw === 'MINIMAL' || raw === 'MEDIUM' || raw === 'HIGH') {
        return raw;
    }
    return 'MEDIUM';
}

/**
 * Bounded LRU cache for pre-renovation Clean Plates (demolished staircases)
 * so switching styles on the same staircase photo skips redundant demolition passes.
 */
const CLEAN_PLATE_CACHE_MAX = 20;
const cleanPlateCache = new Map<string, string>();

function getCleanPlateCacheKey(base64Image: string): string {
    const clean = base64Image.includes(',') ? base64Image.slice(base64Image.indexOf(',') + 1) : base64Image;
    return crypto.createHash('sha256').update(clean).digest('hex');
}

export function clearCleanPlateCache(): void {
    cleanPlateCache.clear();
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

async function loadVertexAI() {
    const { VertexAI } = await import('@google-cloud/vertexai');
    return VertexAI;
}

async function getAccessToken(clientEmail?: string, privateKey?: string): Promise<string> {
    const { GoogleAuth } = await import('google-auth-library');
    const options: any = {
        scopes: 'https://www.googleapis.com/auth/cloud-platform',
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
                projectId: creds.project_id,
            };
        } catch (e) {
            console.error('[ERROR] Failed to parse GOOGLE_APPLICATION_CREDENTIALS', e);
        }
    }
    return {};
}

export async function getGenAIClient(): Promise<any> {
    if (!genAIClient) {
        const { GoogleGenAI } = await import('@google/genai');
        const authOptions = getGoogleAuthOptions();
        const options: GoogleGenAIOptions = {
            vertexai: true,
            project: authOptions.projectId || process.env.VERTEX_PROJECT_ID || 'mock-project',
            location: 'global',
            googleAuthOptions: authOptions.credentials
                ? { credentials: authOptions.credentials }
                : undefined,
        };
        genAIClient = new GoogleGenAI(options);
    }
    return genAIClient;
}

export async function getVertexClient(isGlobal = false): Promise<any> {
    const VertexAIConstructor = await loadVertexAI();

    if (isGlobal) {
        if (!vertexAIGlobal) {
            const authOptions = getGoogleAuthOptions();
            vertexAIGlobal = new VertexAIConstructor({
                project: authOptions.projectId || process.env.VERTEX_PROJECT_ID || 'mock-project',
                location: 'global',
                apiEndpoint: 'aiplatform.googleapis.com',
                googleAuthOptions: authOptions.credentials ? { credentials: authOptions.credentials } : undefined,
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
            googleAuthOptions: authOptions.credentials ? { credentials: authOptions.credentials } : undefined,
        });
    }
    return vertexAI;
}

async function getRouterModel() {
    if (!routerModel) {
        // Vertex Gemini 3.8 Flash routes through the global endpoint rather than regional us-central1.
        const client = await getVertexClient(true);
        routerModel = client.getGenerativeModel({
            model: getConfiguredVisionModelId(),
        });
    }
    return routerModel;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_SYSTEM_INSTRUCTION = DEFAULT_SYNTHESIS_SYSTEM_INSTRUCTION;

export interface TokenUsageMetrics {
    inputTokens: number;
    outputTokens: number;
    textOutputTokens?: number;
    thinkingTokens?: number;
    imageOutputTokens?: number;
}

function extractUsageMetrics(usageMetadata: any): TokenUsageMetrics {
    if (!usageMetadata) {
        return { inputTokens: 0, outputTokens: 0 };
    }
    const details: any[] = Array.isArray(usageMetadata.candidatesTokensDetails)
        ? usageMetadata.candidatesTokensDetails
        : [];
    let imageOutputTokens = 0;
    let textOutputTokens = 0;
    for (const d of details) {
        const mod = String(d.modality || '').toUpperCase();
        const count = Number(d.tokenCount) || 0;
        if (mod === 'IMAGE') imageOutputTokens += count;
        else if (mod === 'TEXT') textOutputTokens += count;
    }
    const thinkingTokens = Number(usageMetadata.thoughtsTokenCount) || 0;

    return {
        inputTokens: Number(usageMetadata.promptTokenCount) || 0,
        outputTokens: Number(usageMetadata.candidatesTokenCount) || 0,
        ...(details.length > 0 ? { textOutputTokens: textOutputTokens + thinkingTokens, imageOutputTokens } : {}),
        ...(thinkingTokens > 0 ? { thinkingTokens } : {}),
    };
}

function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage = 'Operation timed out'): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms)),
    ]);
}

function stripJsonFences(raw: string): string {
    const trimmed = raw.trim();
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch && fenceMatch[1]) {
        return fenceMatch[1].trim();
    }
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        return trimmed.slice(firstBrace, lastBrace + 1);
    }
    return trimmed;
}

function buildSlotLabelText(slotId: StyleSlotId, slotIndex: number): string {
    const def = STYLE_PHOTO_SLOTS.find((s) => s.id === slotId);
    const num = def?.slotNumber ?? slotIndex + 1;
    const title = def?.title ?? slotId;
    if (slotId === 'hero_run' || slotIndex === 0) {
        return `**IMAGE B (SLOT 1 — ${title.toUpperCase()} — Extract Hardware & Style Only, Ignore Background):**`;
    }
    if (slotId === 'post_top_joint' || slotIndex === 1) {
        return `**IMAGE C / SLOT ${num} (${title.toUpperCase()} — Ignore Background):** Inspect closely for exact joint hardware and construction method.`;
    }
    return `**IMAGE C / SLOT ${num} (${title.toUpperCase()} — Ignore Background):** Use this reference slot strictly for its corresponding fabrication detail.`;
}

function isModernThinkingCapableModel(modelId: string): boolean {
    const lower = modelId.toLowerCase();
    return lower.includes('nano-banana-2.1') || lower.includes('gemini-3') || lower.includes('gemini-4');
}

export interface NanoBananaStyleInput {
    base64StyleImages: string[];
    labeledSlotImages?: { slotId: StyleSlotId; base64Data: string }[];
    technicalSpecs?: {
        hasBottomRail?: boolean;
        hasReducers?: boolean | null;
        postMount?: 'top' | 'side' | string;
        description?: string;
        customNote?: string;
        fabricationSpec?: FabricationSpec | null;
        sceneAnalysis?: SceneRouterAnalysis | null;
        hasCleanPlate?: boolean;
    };
}

export interface NanoBananaGenerationResult {
    success: boolean;
    image?: string;
    error?: string;
    modelUsed?: string;
    imageSize?: '1K' | '2K' | '4K';
    usage?: TokenUsageMetrics;
    assistantTurnContent?: { role: string; parts: any[] };
    initialUserParts?: any[];
}

export async function generateDesignWithNanoBanana(
    base64TargetImage: string,
    styleInput: string | NanoBananaStyleInput,
    promptConfig?: { systemInstruction: string; userTemplate: string; negative_prompt?: string },
    options?: { imageSize?: '1K' | '2K' | '4K'; thinkingLevel?: ImageThinkingLevel }
): Promise<NanoBananaGenerationResult> {
    const maxAttempts = 5;
    let attempts = 0;
    let activeModelId = getConfiguredImageModelId();
    let disableImageConfig = false;
    let disableImageSizeField = false;
    let disableThinkingConfig = false;

    const targetImageSize: '1K' | '2K' | '4K' = options?.imageSize || '2K';
    const targetThinkingLevel: ImageThinkingLevel = options?.thinkingLevel || getConfiguredThinkingLevel();

    try {
        const client = await getVertexClient(true);
        client.getGenerativeModel({
            model: activeModelId,
            systemInstruction: promptConfig?.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
        });
    } catch (e) {
        console.warn('[VERTEX] Lazily init failed:', e);
        return { success: false, error: 'AI Service Unavailable: Initialization Failed' };
    }

    const targetPartMeta = parseBase64ImagePart(base64TargetImage);

    while (attempts < maxAttempts) {
        try {
            console.log(`[NANO BANANA] Generation attempt ${attempts + 1} of ${maxAttempts} (${activeModelId})...`);

            const parts: any[] = [];

            // 1. Target Scene Canvas (IMAGE A)
            parts.push({
                text: `**IMAGE A (Immutable Scene Canvas${targetPartMeta.aspectRatio ? ` — Aspect Ratio ${targetPartMeta.aspectRatio}` : ''}):** The user's original staircase. Preserve all room architecture, tread count, walls, flooring, lighting, and camera POV.`,
            });
            parts.push({
                inlineData: {
                    mimeType: targetPartMeta.mimeType,
                    data: targetPartMeta.cleanBase64,
                },
            });

            // 2. Style Reference Photos (Interleaved Labeled Slots or Legacy Image B / Image C)
            let hasExtraStyleRefs = false;
            if (typeof styleInput !== 'string') {
                const labeled = styleInput.labeledSlotImages?.filter((s) => !!s.base64Data) || [];
                if (labeled.length > 0) {
                    hasExtraStyleRefs = labeled.length > 1;
                    labeled.forEach((slotItem, idx) => {
                        const slotMeta = parseBase64ImagePart(slotItem.base64Data);
                        parts.push({ text: buildSlotLabelText(slotItem.slotId, idx) });
                        parts.push({
                            inlineData: {
                                mimeType: slotMeta.mimeType,
                                data: slotMeta.cleanBase64,
                            },
                        });
                    });
                } else if (styleInput.base64StyleImages.length > 0) {
                    const styleImages = styleInput.base64StyleImages;
                    hasExtraStyleRefs = styleImages.length > 1;
                    const primaryStyleMeta = parseBase64ImagePart(styleImages[0]);
                    parts.push({
                        text: '**IMAGE B (Primary Railing Specimen — Extract Hardware & Style Only, Ignore Room Background):** The primary railing design, profile dimensions, and finish reference.',
                    });
                    parts.push({
                        inlineData: {
                            mimeType: primaryStyleMeta.mimeType,
                            data: primaryStyleMeta.cleanBase64,
                        },
                    });

                    if (hasExtraStyleRefs) {
                        parts.push({
                            text: '**IMAGE C (Detailed Hardware & Fabrication Close-Ups — Ignore Background):** Additional reference photos showing exact joints, post mounting hardware, and construction details.',
                        });
                        for (let i = 1; i < styleImages.length; i++) {
                            const refMeta = parseBase64ImagePart(styleImages[i]);
                            parts.push({
                                inlineData: {
                                    mimeType: refMeta.mimeType,
                                    data: refMeta.cleanBase64,
                                },
                            });
                        }
                    }
                }
            }

            const specs =
                typeof styleInput !== 'string' && styleInput.technicalSpecs
                    ? {
                          hasBottomRail: styleInput.technicalSpecs.hasBottomRail,
                          postMount: styleInput.technicalSpecs.postMount as 'top' | 'side' | null | undefined,
                          hasReducers: styleInput.technicalSpecs.hasReducers,
                          customPrompt: styleInput.technicalSpecs.customNote,
                          fabricationSpec: styleInput.technicalSpecs.fabricationSpec,
                      }
                    : {};

            const styleDescription =
                typeof styleInput === 'string'
                    ? styleInput
                    : styleInput.technicalSpecs?.description || 'The attached Style Reference Images';

            const sceneAnalysis =
                typeof styleInput !== 'string' ? styleInput.technicalSpecs?.sceneAnalysis : null;
            const hasCleanPlate =
                typeof styleInput !== 'string' ? styleInput.technicalSpecs?.hasCleanPlate : false;

            const builtPrompts = buildRailingSynthesisPrompts({
                styleDescription,
                specs,
                sceneAnalysis,
                hasCleanPlate,
                hasDetailPhotos: hasExtraStyleRefs,
                customMasterTemplate: promptConfig?.userTemplate,
            });

            const finalSystemInstruction = (
                promptConfig?.systemInstruction?.trim() && promptConfig.systemInstruction.trim().length >= 80
                    ? promptConfig.systemInstruction
                    : builtPrompts.systemInstruction
            ).replace('{{DATE}}', new Date().toISOString().split('T')[0]);

            parts.push({ text: builtPrompts.promptText });

            const authOptions = getGoogleAuthOptions();
            const token = await getAccessToken(
                authOptions.credentials?.client_email,
                authOptions.credentials?.private_key
            );
            let projectId = authOptions.projectId || process.env.VERTEX_PROJECT_ID;
            if (!projectId) {
                try {
                    const { GoogleAuth } = await import('google-auth-library');
                    const auth = new GoogleAuth();
                    projectId = await auth.getProjectId();
                } catch {
                    // Preserve mocked default
                }
            }
            const resolvedProjectId = projectId || 'railvision-480923';
            const url = `https://aiplatform.googleapis.com/v1/projects/${resolvedProjectId}/locations/global/publishers/google/models/${activeModelId}:generateContent`;

            // Thinking models perform best without low-temperature clamping; allow full headroom for thinking + 2K output.
            const generationConfig: Record<string, any> = {
                maxOutputTokens: 8192,
            };

            if (!disableThinkingConfig && isModernThinkingCapableModel(activeModelId)) {
                generationConfig.thinkingConfig = {
                    thinkingLevel: targetThinkingLevel,
                };
            }

            if (!disableImageConfig) {
                const imgCfg: Record<string, any> = {};
                if (targetPartMeta.aspectRatio) {
                    imgCfg.aspectRatio = targetPartMeta.aspectRatio;
                }
                if (!disableImageSizeField && activeModelId.toLowerCase().includes('nano-banana')) {
                    imgCfg.imageSize = targetImageSize;
                }
                if (Object.keys(imgCfg).length > 0) {
                    generationConfig.imageConfig = imgCfg;
                }
            }

            const rawResponse = await withTimeout(
                fetch(url, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        systemInstruction: {
                            parts: [{ text: finalSystemInstruction }],
                        },
                        contents: [{ role: 'user', parts }],
                        generationConfig,
                    }),
                }),
                120000,
                'Vertex AI Generation Timed Out (120s)'
            );

            if (!rawResponse.ok) {
                const text = await rawResponse.text();
                if (rawResponse.status === 404 && activeModelId !== LEGACY_FALLBACK_IMAGE_MODEL) {
                    const nextModel =
                        activeModelId !== FALLBACK_IMAGE_MODEL
                            ? FALLBACK_IMAGE_MODEL
                            : LEGACY_FALLBACK_IMAGE_MODEL;
                    console.warn(`[VERTEX] Model ${activeModelId} returned 404; falling back to ${nextModel}`);
                    activeModelId = nextModel;
                    continue;
                }
                if (rawResponse.status === 400) {
                    if (!disableThinkingConfig && generationConfig.thinkingConfig) {
                        console.warn('[VERTEX] Retrying without thinkingConfig after 400 response');
                        disableThinkingConfig = true;
                        continue;
                    }
                    if (!disableImageSizeField && generationConfig.imageConfig?.imageSize) {
                        console.warn('[VERTEX] Retrying without imageConfig.imageSize after 400 response');
                        disableImageSizeField = true;
                        continue;
                    }
                    if (!disableImageConfig && generationConfig.imageConfig) {
                        console.warn('[VERTEX] Retrying without imageConfig after 400 response');
                        disableImageConfig = true;
                        continue;
                    }
                }
                throw new Error(`Vertex API Error ${rawResponse.status}: ${text}`);
            }

            const responseJson = await rawResponse.json();
            const usage = extractUsageMetrics(responseJson.usageMetadata);
            const candidate = responseJson.candidates?.[0];
            if (!candidate || !candidate.content?.parts) {
                throw new Error('No candidates returned');
            }

            for (const part of candidate.content.parts) {
                if (part.thought) continue;
                if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
                    return {
                        success: true,
                        image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                        modelUsed: activeModelId,
                        imageSize: disableImageSizeField ? '1K' : targetImageSize,
                        usage,
                        assistantTurnContent: candidate.content,
                        initialUserParts: parts,
                    };
                }
            }

            throw new Error('Model returned text/thoughts instead of image.');
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
                    await sleep(baseDelay + jitter);
                    continue;
                }
            }
            return { success: false, error: error.message || 'Unknown error during Nano Banana generation' };
        }
    }

    return { success: false, error: 'Server is busy, please try again in 1 minute.' };
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
        const issue = SECOND_PASS_ISSUES.find((i) => i.id === targetId);
        if (issue) {
            const hasDetailImg = !!config.detail_images?.[targetId];
            if (hasDetailImg) {
                issues.push(
                    `* ${issue.prompt} (Refer to the attached CLOSE-UP REFERENCE for ${issue.uploadLabel} to replicate this exact physical appearance and fabrication detail)`
                );
            } else {
                issues.push(`* ${issue.prompt}`);
            }
        }
    }

    if (config.custom_prompt && config.custom_prompt.trim()) {
        issues.push(`* CUSTOM REFINEMENT: ${config.custom_prompt.trim()}`);
    }

    if (issues.length === 0) {
        return '';
    }

    return `Perform a targeted micro-refinement on this railing photograph.
Preserve the room, walls, stair treads, background, lighting, and general scene perspective exactly as shown.
When removing any unwanted mounting plates, brackets, or ghosted spindles, restore the underlying stair tread, nosing, stringer, or wall surface cleanly using the Original Staircase Background reference if provided (never re-introduce the demolished old railing from the original before-photo).
Apply the following specific fabrication enhancements:
${issues.join('\n')}
Output a single unified high-resolution photograph.`;
}

export interface MultiTurnRefinementContext {
    initialUserParts?: any[];
    assistantTurnContent?: { role: string; parts: any[] };
    qaInstructions?: string;
}

export async function refineDesignWithNanoBanana(
    base64Image: string,
    refinementPrompt: string,
    referenceImages?: string[],
    detailImages?: SecondPassDetailImage[],
    originalSceneBase64?: string,
    multiTurnContext?: MultiTurnRefinementContext
): Promise<{
    success: boolean;
    image?: string;
    error?: string;
    modelUsed?: string;
    usage?: TokenUsageMetrics;
}> {
    const maxAttempts = 3;
    let attempts = 0;
    let activeModelId = getConfiguredImageModelId();
    let disableImageConfig = false;
    let disableImageSizeField = false;
    let disableThinkingConfig = false;
    let forceSingleTurnFallback = false;

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

    const singleTurnParts: any[] = [
        { text: '**CANVAS TO REFINE:** Input railing photograph from Pass 1:' },
        {
            inlineData: {
                mimeType: canvasMeta.mimeType,
                data: canvasMeta.cleanBase64,
            },
        },
    ];

    if (originalSceneBase64) {
        const sceneMeta = parseBase64ImagePart(originalSceneBase64);
        singleTurnParts.push({
            text: '**ORIGINAL STAIRCASE BACKGROUND (BARE SURFACE TEXTURE REFERENCE ONLY):** Use this before-photo ONLY to sample authentic bare stair tread wood/carpet, nosings, stringers, or wall paint behind any misplaced plates, posts, or ghosted spindles you remove. CRITICAL: Ignore the old pre-renovation handrail in this before-photo—never copy old balusters, posts, or rails back onto the canvas.',
        });
        singleTurnParts.push({
            inlineData: {
                mimeType: sceneMeta.mimeType,
                data: sceneMeta.cleanBase64,
            },
        });
    }

    const followUpHardwareParts: any[] = [];
    if (detailImages && detailImages.length > 0) {
        for (const detail of detailImages) {
            const detailMeta = parseBase64ImagePart(detail.base64Data);
            const detailBlock = [
                {
                    text: `**CLOSE-UP REFERENCE (${detail.label.toUpperCase()}):** Inspect this close-up photo showing the exact required fabrication and hardware detail. Replicate this exact physical appearance onto the canvas railing.`,
                },
                {
                    inlineData: {
                        mimeType: detailMeta.mimeType,
                        data: detailMeta.cleanBase64,
                    },
                },
            ];
            singleTurnParts.push(...detailBlock);
            followUpHardwareParts.push(...detailBlock);
        }
    }

    if (referenceImages && referenceImages.length > 0) {
        singleTurnParts.push({
            text: '**STYLE & HARDWARE CONTEXT REFERENCES (IGNORE BACKGROUNDS):** Inspect closely for connection hardware, post joints, and mounting details:',
        });
        for (const refImg of referenceImages.slice(0, 4)) {
            const refMeta = parseBase64ImagePart(refImg);
            singleTurnParts.push({
                inlineData: {
                    mimeType: refMeta.mimeType,
                    data: refMeta.cleanBase64,
                },
            });
        }
    }

    const combinedRefinementText = multiTurnContext?.qaInstructions
        ? `${refinementPrompt}\n\n### SURGICAL QA FIX INSTRUCTIONS:\n${multiTurnContext.qaInstructions}`
        : refinementPrompt;

    singleTurnParts.push({ text: combinedRefinementText });

    const hasThoughtSignatures = Boolean(
        multiTurnContext?.initialUserParts &&
            multiTurnContext?.assistantTurnContent?.parts?.some(
                (p: any) => Boolean(p?.thoughtSignature || p?.thought_signature)
            )
    );

    while (attempts < maxAttempts) {
        try {
            const authOptions = getGoogleAuthOptions();
            const token = await getAccessToken(
                authOptions.credentials?.client_email,
                authOptions.credentials?.private_key
            );
            const projectId = authOptions.projectId || process.env.VERTEX_PROJECT_ID || 'railvision-480923';
            const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${activeModelId}:generateContent`;

            const generationConfig: Record<string, any> = {
                maxOutputTokens: 8192,
            };

            if (!disableThinkingConfig && isModernThinkingCapableModel(activeModelId)) {
                generationConfig.thinkingConfig = {
                    thinkingLevel: getConfiguredThinkingLevel(),
                };
            }

            if (!disableImageConfig) {
                const imgCfg: Record<string, any> = {};
                if (canvasMeta.aspectRatio) {
                    imgCfg.aspectRatio = canvasMeta.aspectRatio;
                }
                if (!disableImageSizeField && activeModelId.toLowerCase().includes('nano-banana')) {
                    imgCfg.imageSize = '2K';
                }
                if (Object.keys(imgCfg).length > 0) {
                    generationConfig.imageConfig = imgCfg;
                }
            }

            // Use stateful multi-turn conversation with preserved thoughtSignature whenever available.
            const useMultiTurn = !forceSingleTurnFallback && hasThoughtSignatures;
            const contentsPayload = useMultiTurn
                ? [
                      { role: 'user', parts: multiTurnContext!.initialUserParts },
                      {
                          role: multiTurnContext!.assistantTurnContent!.role || 'model',
                          parts: multiTurnContext!.assistantTurnContent!.parts,
                      },
                      {
                          role: 'user',
                          parts: [
                              ...followUpHardwareParts,
                              {
                                  text: `Look closely at the railing image you just generated. Keep the staircase, room background, and layout locked, and execute this targeted surgical refinement:\n\n${combinedRefinementText}`,
                              },
                          ],
                      },
                  ]
                : [{ role: 'user', parts: singleTurnParts }];

            const rawResponse = await withTimeout(
                fetch(url, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        systemInstruction: {
                            parts: [{ text: systemInstruction }],
                        },
                        contents: contentsPayload,
                        generationConfig,
                    }),
                }),
                120000,
                'Vertex AI Refinement Timed Out (120s)'
            );

            if (!rawResponse.ok) {
                const text = await rawResponse.text();
                if (rawResponse.status === 404 && activeModelId !== LEGACY_FALLBACK_IMAGE_MODEL) {
                    activeModelId =
                        activeModelId !== FALLBACK_IMAGE_MODEL
                            ? FALLBACK_IMAGE_MODEL
                            : LEGACY_FALLBACK_IMAGE_MODEL;
                    continue;
                }
                if (rawResponse.status === 400) {
                    if (useMultiTurn) {
                        console.warn('[REFINEMENT] Multi-turn rejected with 400; falling back to single-turn refinement');
                        forceSingleTurnFallback = true;
                        continue;
                    }
                    if (!disableThinkingConfig && generationConfig.thinkingConfig) {
                        disableThinkingConfig = true;
                        continue;
                    }
                    if (!disableImageSizeField && generationConfig.imageConfig?.imageSize) {
                        disableImageSizeField = true;
                        continue;
                    }
                    if (!disableImageConfig && generationConfig.imageConfig) {
                        disableImageConfig = true;
                        continue;
                    }
                }
                throw new Error(`Vertex Refinement API Error ${rawResponse.status}: ${text}`);
            }

            const responseJson = await rawResponse.json();
            const usage = extractUsageMetrics(responseJson.usageMetadata);
            const candidate = responseJson.candidates?.[0];
            if (!candidate || !candidate.content?.parts) {
                throw new Error('No candidates returned from refinement');
            }

            for (const part of candidate.content.parts) {
                if (part.thought) continue;
                if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
                    return {
                        success: true,
                        image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                        modelUsed: activeModelId,
                        usage,
                    };
                }
            }

            throw new Error('Model returned no image during refinement.');
        } catch (error: any) {
            console.error(`[REFINEMENT ERROR] Attempt ${attempts + 1} failed:`, error);
            attempts++;
            if (attempts < maxAttempts) {
                await sleep(2000 * attempts);
                continue;
            }
            return { success: false, error: error.message || 'Failed during second-pass refinement' };
        }
    }

    return { success: false, error: 'Refinement server busy.' };
}

/**
 * Shared Vertex AI Vision JSON caller powered by gemini-3.8-flash (with graceful
 * codeExecution fallback when Agentic Vision is requested).
 */
async function callVertexVisionJson<T>(params: {
    parts: any[];
    systemInstruction?: string;
    enableCodeExecution?: boolean;
    thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    timeoutMs?: number;
    maxOutputTokens?: number;
}): Promise<{ data: T; usage: TokenUsageMetrics; modelUsed: string }> {
    let modelId = getConfiguredVisionModelId();
    let disableCodeExecution = !params.enableCodeExecution;
    let disableThinkingConfig = false;

    for (let attempt = 0; attempt < 4; attempt++) {
        const authOptions = getGoogleAuthOptions();
        const token = await getAccessToken(
            authOptions.credentials?.client_email,
            authOptions.credentials?.private_key
        );
        const projectId = authOptions.projectId || process.env.VERTEX_PROJECT_ID || 'railvision-480923';
        const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${modelId}:generateContent`;

        // Gemini 3.6+ / 3.8 Flash deprecate sampling controls (`temperature`, `top_p`, `top_k`); rely on thinkingLevel + JSON mode.
        const generationConfig: Record<string, any> = {
            maxOutputTokens: params.maxOutputTokens || 2048,
            ...(!disableCodeExecution ? {} : { responseMimeType: 'application/json' }),
        };

        if (!disableThinkingConfig && modelId.startsWith('gemini-3')) {
            generationConfig.thinkingConfig = {
                thinkingLevel: params.thinkingLevel || 'LOW',
            };
        }

        const payload: Record<string, any> = {
            contents: [{ role: 'user', parts: params.parts }],
            generationConfig,
        };

        if (params.systemInstruction) {
            payload.systemInstruction = { parts: [{ text: params.systemInstruction }] };
        }
        if (!disableCodeExecution) {
            payload.tools = [{ codeExecution: {} }];
        }

        const res = await withTimeout(
            fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            }),
            params.timeoutMs || 45000,
            'Vision analysis timed out'
        );

        if (!res.ok) {
            const errBody = await res.text();
            if (res.status === 400 && !disableCodeExecution) {
                console.warn('[VISION] Disabling codeExecution tool after 400 response, retrying with JSON mode');
                disableCodeExecution = true;
                continue;
            }
            if (res.status === 400 && !disableThinkingConfig && generationConfig.thinkingConfig) {
                console.warn('[VISION] Disabling thinkingConfig after 400 response');
                disableThinkingConfig = true;
                continue;
            }
            if (res.status === 404 && modelId !== 'gemini-3.5-flash-lite') {
                modelId = 'gemini-3.5-flash-lite';
                continue;
            }
            throw new Error(`Vertex Vision Error ${res.status}: ${errBody}`);
        }

        const json = await res.json();
        const usage = extractUsageMetrics(json.usageMetadata);
        const candidateParts: any[] = json.candidates?.[0]?.content?.parts || [];
        const textChunks = candidateParts
            .filter((p) => !p.thought && typeof p.text === 'string')
            .map((p) => p.text)
            .join('\n');

        const parsed = JSON.parse(stripJsonFences(textChunks)) as T;
        return { data: parsed, usage, modelUsed: modelId };
    }

    throw new Error('Vision call exhausted retry budget');
}

export async function analyzeSceneWithRouter(base64TargetImage: string): Promise<{
    analysis: SceneRouterAnalysis;
    usage: TokenUsageMetrics;
    modelUsed: string;
}> {
    const meta = parseBase64ImagePart(base64TargetImage);
    const { data, usage, modelUsed } = await callVertexVisionJson<SceneRouterAnalysis>({
        parts: [
            { inlineData: { mimeType: meta.mimeType, data: meta.cleanBase64 } },
            { text: buildSceneRouterPrompt() },
        ],
        timeoutMs: 30000,
        maxOutputTokens: 1200,
    });
    return { analysis: data, usage, modelUsed };
}

export async function getOrCreateCleanPlate(
    base64TargetImage: string,
    sceneAnalysis?: SceneRouterAnalysis | null
): Promise<{
    cleanPlateBase64: string;
    didDemolish: boolean;
    cached: boolean;
    modelUsed?: string;
    usage: TokenUsageMetrics;
}> {
    if (sceneAnalysis && !sceneAnalysis.demolition_required && !sceneAnalysis.existing_railing_present) {
        return {
            cleanPlateBase64: base64TargetImage,
            didDemolish: false,
            cached: false,
            usage: { inputTokens: 0, outputTokens: 0 },
        };
    }

    const cacheKey = getCleanPlateCacheKey(base64TargetImage);
    const hit = cleanPlateCache.get(cacheKey);
    if (hit) {
        // Refresh LRU order
        cleanPlateCache.delete(cacheKey);
        cleanPlateCache.set(cacheKey, hit);
        return {
            cleanPlateBase64: hit,
            didDemolish: true,
            cached: true,
            usage: { inputTokens: 0, outputTokens: 0 },
        };
    }

    const targetMeta = parseBase64ImagePart(base64TargetImage);
    const activeModelId = getConfiguredImageModelId();
    const authOptions = getGoogleAuthOptions();
    const token = await getAccessToken(
        authOptions.credentials?.client_email,
        authOptions.credentials?.private_key
    );
    const projectId = authOptions.projectId || process.env.VERTEX_PROJECT_ID || 'railvision-480923';

    const prompt = buildCleanPlateDemolitionPrompt(sceneAnalysis);
    let disableThinkingConfig = false;
    let disableImageSizeField = false;
    let disableImageConfig = false;

    try {
        for (let attempt = 0; attempt < 3; attempt++) {
            const generationConfig: Record<string, any> = {
                maxOutputTokens: 8192,
                ...(!disableThinkingConfig && isModernThinkingCapableModel(activeModelId)
                    ? { thinkingConfig: { thinkingLevel: 'MINIMAL' } }
                    : {}),
                ...(!disableImageConfig && targetMeta.aspectRatio
                    ? {
                          imageConfig: {
                              aspectRatio: targetMeta.aspectRatio,
                              ...(!disableImageSizeField && activeModelId.toLowerCase().includes('nano-banana')
                                  ? { imageSize: '1K' }
                                  : {}),
                          },
                      }
                    : {}),
            };

            const res = await withTimeout(
                fetch(
                    `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${activeModelId}:generateContent`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            contents: [
                                {
                                    role: 'user',
                                    parts: [
                                        { text: '**IMAGE A (STAIRCASE TO DEMOLISH):**' },
                                        { inlineData: { mimeType: targetMeta.mimeType, data: targetMeta.cleanBase64 } },
                                        { text: prompt },
                                    ],
                                },
                            ],
                            generationConfig,
                        }),
                    }
                ),
                90000,
                'Clean plate demolition timed out'
            );

            if (!res.ok) {
                if (res.status === 400) {
                    if (!disableThinkingConfig && generationConfig.thinkingConfig) {
                        disableThinkingConfig = true;
                        continue;
                    }
                    if (!disableImageSizeField && generationConfig.imageConfig?.imageSize) {
                        disableImageSizeField = true;
                        continue;
                    }
                    if (!disableImageConfig && generationConfig.imageConfig) {
                        disableImageConfig = true;
                        continue;
                    }
                }
                break;
            }

            const json = await res.json();
            const usage = extractUsageMetrics(json.usageMetadata);
            const parts: any[] = json.candidates?.[0]?.content?.parts || [];
            for (const p of parts) {
                if (!p.thought && p.inlineData?.mimeType?.startsWith('image/')) {
                    const cleanDataUri = `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`;
                    if (cleanPlateCache.size >= CLEAN_PLATE_CACHE_MAX) {
                        const oldestKey = cleanPlateCache.keys().next().value;
                        if (oldestKey) cleanPlateCache.delete(oldestKey);
                    }
                    cleanPlateCache.set(cacheKey, cleanDataUri);
                    return {
                        cleanPlateBase64: cleanDataUri,
                        didDemolish: true,
                        cached: false,
                        modelUsed: activeModelId,
                        usage,
                    };
                }
            }
            break;
        }
    } catch (err) {
        console.warn('[CLEAN PLATE] Non-fatal error during clean-plate pass; falling back to original canvas:', err);
    }

    return {
        cleanPlateBase64: base64TargetImage,
        didDemolish: false,
        cached: false,
        usage: { inputTokens: 0, outputTokens: 0 },
    };
}

export async function verifyRenderQualityWithVisionQA(params: {
    originalSceneBase64: string;
    renderedImageBase64: string;
    styleImages: string[];
    detailImages?: SecondPassDetailImage[];
    specs: {
        hasBottomRail?: boolean;
        postMount?: 'top' | 'side' | null;
        hasReducers?: boolean | null;
        fabricationSpec?: FabricationSpec | null;
    };
}): Promise<{ qa: VisionQaResult; usage: TokenUsageMetrics; modelUsed: string }> {
    const origMeta = parseBase64ImagePart(params.originalSceneBase64);
    const renderedMeta = parseBase64ImagePart(params.renderedImageBase64);

    const parts: any[] = [
        { text: '**1. ORIGINAL / BARE STAIRCASE SCENE:**' },
        { inlineData: { mimeType: origMeta.mimeType, data: origMeta.cleanBase64 } },
    ];

    params.styleImages.slice(0, 3).forEach((img, idx) => {
        const m = parseBase64ImagePart(img);
        parts.push({ text: `**STYLE REFERENCE #${idx + 1}:**` });
        parts.push({ inlineData: { mimeType: m.mimeType, data: m.cleanBase64 } });
    });

    (params.detailImages || []).slice(0, 4).forEach((d) => {
        const m = parseBase64ImagePart(d.base64Data);
        parts.push({ text: `**CLOSE-UP DETAIL (${d.targetId}):**` });
        parts.push({ inlineData: { mimeType: m.mimeType, data: m.cleanBase64 } });
    });

    parts.push({ text: '**FINAL IMAGE TO INSPECT (RENDERED PASS 1):**' });
    parts.push({ inlineData: { mimeType: renderedMeta.mimeType, data: renderedMeta.cleanBase64 } });
    parts.push({
        text: buildVisionQaPrompt(
            params.specs,
            (params.detailImages || []).map((d) => d.targetId)
        ),
    });

    const { data, usage, modelUsed } = await callVertexVisionJson<VisionQaResult>({
        parts,
        enableCodeExecution: true,
        thinkingLevel: 'MEDIUM',
        timeoutMs: 45000,
        maxOutputTokens: 2048,
    });

    return { qa: data, usage, modelUsed };
}

export async function validateStylePhotoWithVision(params: {
    base64Image: string;
    slotId: StyleSlotId;
    category?: FabricationCategory;
}): Promise<{
    result: {
        valid: boolean;
        qualityScore: number;
        slotMatch: boolean;
        feedback: string;
        suggestions: string[];
    };
    usage: TokenUsageMetrics;
    modelUsed: string;
}> {
    const slotDef = STYLE_PHOTO_SLOTS.find((s) => s.id === params.slotId);
    if (!slotDef) {
        throw new Error(`Unknown style photo slot: ${params.slotId}`);
    }
    const meta = parseBase64ImagePart(params.base64Image);
    const { data, usage, modelUsed } = await callVertexVisionJson<{
        valid: boolean;
        qualityScore: number;
        slotMatch: boolean;
        feedback: string;
        suggestions: string[];
    }>({
        parts: [
            { inlineData: { mimeType: meta.mimeType, data: meta.cleanBase64 } },
            { text: buildPhotoValidatorPrompt(slotDef, params.category || 'stair_railing') },
        ],
        timeoutMs: 25000,
        maxOutputTokens: 800,
    });

    return { result: data, usage, modelUsed };
}

export async function extractFabricationSpecWithVision(params: {
    labeledImages: { slotId: StyleSlotId; base64Data: string }[];
    category?: FabricationCategory;
    hints?: {
        name?: string;
        description?: string;
        postMount?: string | null;
        hasReducers?: boolean | null;
        hasBottomRail?: boolean | null;
    };
}): Promise<{ spec: FabricationSpec; usage: TokenUsageMetrics; modelUsed: string }> {
    const parts: any[] = [];
    const slotDescriptions: { slotId: StyleSlotId; index: number }[] = [];

    params.labeledImages.forEach((item, idx) => {
        const meta = parseBase64ImagePart(item.base64Data);
        slotDescriptions.push({ slotId: item.slotId, index: idx });
        parts.push({ text: `Photo #${idx + 1} — ${item.slotId}:` });
        parts.push({ inlineData: { mimeType: meta.mimeType, data: meta.cleanBase64 } });
    });

    parts.push({
        text: buildFabSpecExtractorPrompt(slotDescriptions, params.category || 'stair_railing', params.hints),
    });

    const { data, usage, modelUsed } = await callVertexVisionJson<FabricationSpec>({
        parts,
        thinkingLevel: 'MEDIUM',
        timeoutMs: 40000,
        maxOutputTokens: 2048,
    });

    return { spec: data, usage, modelUsed };
}

export async function generateCanonicalCutoutWithNanoBanana(params: {
    labeledImages: { slotId: StyleSlotId; base64Data: string }[];
    fabricationSpec: FabricationSpec;
}): Promise<NanoBananaGenerationResult> {
    const authOptions = getGoogleAuthOptions();
    const token = await getAccessToken(
        authOptions.credentials?.client_email,
        authOptions.credentials?.private_key
    );
    const projectId = authOptions.projectId || process.env.VERTEX_PROJECT_ID || 'railvision-480923';
    const activeModelId = getConfiguredImageModelId();

    const parts: any[] = [];
    params.labeledImages.slice(0, 6).forEach((item, idx) => {
        const meta = parseBase64ImagePart(item.base64Data);
        parts.push({ text: buildSlotLabelText(item.slotId, idx) });
        parts.push({ inlineData: { mimeType: meta.mimeType, data: meta.cleanBase64 } });
    });
    parts.push({ text: buildCanonicalSpecimenPrompt(params.fabricationSpec) });

    const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${activeModelId}:generateContent`;
    let disableThinkingConfig = false;
    let disableImageSizeField = false;

    for (let attempt = 0; attempt < 3; attempt++) {
        const generationConfig: Record<string, any> = {
            maxOutputTokens: 8192,
            ...(!disableThinkingConfig && isModernThinkingCapableModel(activeModelId)
                ? { thinkingConfig: { thinkingLevel: 'MINIMAL' } }
                : {}),
            imageConfig: {
                aspectRatio: '4:3',
                ...(!disableImageSizeField && activeModelId.toLowerCase().includes('nano-banana')
                    ? { imageSize: '2K' }
                    : {}),
            },
        };

        const res = await withTimeout(
            fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts }],
                    generationConfig,
                }),
            }),
            90000,
            'Canonical specimen generation timed out'
        );

        if (!res.ok) {
            const err = await res.text();
            if (res.status === 400) {
                if (!disableThinkingConfig && generationConfig.thinkingConfig) {
                    disableThinkingConfig = true;
                    continue;
                }
                if (!disableImageSizeField && generationConfig.imageConfig?.imageSize) {
                    disableImageSizeField = true;
                    continue;
                }
            }
            return { success: false, error: `Canonical specimen error ${res.status}: ${err}` };
        }

        const json = await res.json();
        const usage = extractUsageMetrics(json.usageMetadata);
        const candidateParts: any[] = json.candidates?.[0]?.content?.parts || [];
        for (const part of candidateParts) {
            if (!part.thought && part.inlineData?.mimeType?.startsWith('image/')) {
                return {
                    success: true,
                    image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                    modelUsed: activeModelId,
                    imageSize: disableImageSizeField ? '1K' : '2K',
                    usage,
                };
            }
        }
        break;
    }

    return { success: false, error: 'Model returned no image for canonical studio specimen' };
}

export { getRouterModel, DEFAULT_SYSTEM_INSTRUCTION };
