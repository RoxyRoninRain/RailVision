import { VertexAI } from '@google-cloud/vertexai';

// Initialize Vertex with your Cloud project and location
const projectId = process.env.VERTEX_PROJECT_ID;
const location = process.env.VERTEX_LOCATION || 'us-central1';

if (!projectId && process.env.NODE_ENV !== 'development') {
    console.warn("VERTEX_PROJECT_ID is not set.");
}

// Parse credentials from Env Var (Vercel support)
let googleAuthOptions = {};
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
        const credsStr = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        // Check if Base64 (starts with non-brace) or JSON
        const isBase64 = !credsStr.trim().startsWith('{');
        console.log(`[DEBUG] Found GOOGLE_APPLICATION_CREDENTIALS. Is Base64? ${isBase64}`);
        const jsonStr = isBase64 ? Buffer.from(credsStr, 'base64').toString('utf-8') : credsStr;
        googleAuthOptions = { credentials: JSON.parse(jsonStr) };
        console.log('[DEBUG] Credentials parsed successfully');
    } catch (e) {
        console.error("[ERROR] Failed to parse GOOGLE_APPLICATION_CREDENTIALS", e);
    }
}

const vertexAI = new VertexAI({
    project: projectId || 'mock-project',
    location: location, // e.g. us-central1
    googleAuthOptions
});

// CRITICAL: Gemini 3 Pro Image Preview requires GLOBAL endpoint
const vertexAIGlobal = new VertexAI({
    project: projectId || 'mock-project',
    location: 'global',
    apiEndpoint: 'aiplatform.googleapis.com', // Explicitly set global API endpoint
    googleAuthOptions
});

// Specialized model instantiation can go here
export const getGeminiModel = () => {
    // Fallback to 1.0 Pro which is most widely available
    return vertexAI.getGenerativeModel({ model: 'gemini-1.0-pro' });
};

// Update return type
export async function generateDesignWithNanoBanana(
    base64TargetImage: string,
    styleInput: string | { base64StyleImage: string },
    promptConfig?: { systemInstruction: string; userTemplate: string; negative_prompt?: string }
): Promise<{ success: boolean; image?: string; error?: string; usage?: { inputTokens: number; outputTokens: number } }> {
    try {
        console.log('[NANO BANANA] Initializing generation...');
        // User requested: gemini-3-pro-image-preview
        // Must use Global client
        const model = vertexAIGlobal.getGenerativeModel({
            model: 'gemini-3-pro-image-preview',
            // Inject System Instruction if provided, otherwise default to "Hybrid Architect" fallback
            systemInstruction: promptConfig?.systemInstruction || `You are a world-renowned architectural visualization expert. Your goal is to produce indistinguishable-from-reality renovations.

**PHASE 1: IMAGE ANALYSIS (Internal Thought)**.
Before drawing, you must analyze the inputs:
1.  **Source Analysis**: Identify the PERSPECTIVE (camera angle), LIGHTING (direction, color temp), and GEOMETRY (stair pitch, treads, stringers).
2.  **Style Analysis**: Identify the HANDRAIL MATERIAL (e.g., matte black steel, glass), MOUNTING STYLE (side-mount vs. top-mount), and FINISH quality.

**PHASE 2: IMAGE GENERATION**
Using your analysis, generate a pixel-perfect renovation.
-   **STRICT KEEP**: You must keep the original stairs, treads, walls, flooring, and background EXACTLY as they are. DO NOT change the camera angle.
-   **STRICT CHANGE**: You must remove the existing handrail (if any) and install the NEW handrail style from the reference image.
-   **REALISM**: Ensure shadows cast by the new railing match the original lighting direction.`
        });

        const parts: any[] = [];

        // 1. Add Target Image (The stairs to redesign)
        parts.push({
            inlineData: {
                mimeType: 'image/jpeg',
                data: base64TargetImage
            }
        });

        // 2. Add Style Reference if image-based
        if (typeof styleInput !== 'string') {
            parts.push({
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: styleInput.base64StyleImage
                }
            });
        }

        // 3. Construct Text Prompt
        // Use userTemplate if provided, otherwise fallback
        let promptText = promptConfig?.userTemplate || `[Input: Source Image (The space to renovate), Style Reference Image (The desired handrail design)]
Command: 
1. Analyze the GEOMETRY of the Source Image (stairs, walls, lighting).
2. Analyze the HANDRAIL STYLE of the Reference Image. Focus ONLY on the railing materials, shape, and mounting hardware. Ignore the flooring, walls, or other elements in the reference.
3. GENERATE the renovation: Replace the existing handrail in the Source Image with the Handrail Style from the Reference Image.
4. CONSTRAINT: You must STRICTLY preserve the original stair geometry and lighting of the Source Image.`;

        // VARIABLE REPLACEMENT: {{style}}
        // If the user uses {{style}} in their prompt, we replace it with the style description.
        // If not, we append the style description at the end.
        const styleText = typeof styleInput === 'string' ? styleInput : "the attached Style Reference Image";

        if (promptText.includes('{{style}}')) {
            promptText = promptText.replace('{{style}}', styleText);
        } else if (typeof styleInput === 'string') {
            // Append if not used as variable
            promptText += `\n\nTarget Style: "${styleInput}"`;
        }

        // 4. Append Negative Prompt if provided
        if (promptConfig?.negative_prompt) {
            promptText += `\n\nNEGATIVE CONSTRAINTS (MUST AVOID): ${promptConfig.negative_prompt}`;
        }

        parts.push({ text: promptText });

        const request = {
            contents: [{ role: 'user', parts }]
        };

        console.log('[GEMINI 3.0] Sending request to Gemini 3.0 Pro Image (Global)...');
        // Log the prompt being used for debugging
        console.log('[DEBUG] System Instruction:', promptConfig?.systemInstruction ? 'Custom from DB' : 'Default Hybrid');
        console.log('[DEBUG] User Prompt:', promptText);

        const result = await model.generateContent(request);
        const response = await result.response;

        console.log('[DEBUG] Token Usage:', JSON.stringify(response.usageMetadata));

        const usage = {
            inputTokens: response.usageMetadata?.promptTokenCount || 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount || 0
        };

        // Gemini 3.0 Image Generation usually returns inline data differently or as a standard part.
        // Assuming standard candidate part structure for image output if supported multimodally.
        // NOTE: For 'generateContent' with image output, check for executable code or inline data.

        // Let's inspect the response structure safely
        const candidate = response.candidates?.[0];
        if (!candidate) throw new Error("No candidates returned");

        // Check for images in the parts
        for (const part of candidate.content.parts) {
            // @ts-ignore
            if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
                return {
                    success: true,
                    // @ts-ignore
                    image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                    usage
                };
            }
        }

        console.warn('[NANO BANANA] Response did not contain inline image. Checking for other formats...');
        // If no image found, it might have failed or returned text.
        // @ts-ignore
        return { success: false, error: "Model returned text instead of image: " + candidate.content.parts[0].text?.substring(0, 100) };

    } catch (error: any) {
        console.error('[NANO BANANA ERROR]', error);
        return { success: false, error: error.message || "Unknown error during Nano Banana generation" };
    }
}

export { vertexAI };
