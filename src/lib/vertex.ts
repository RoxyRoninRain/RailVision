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
    location,
    googleAuthOptions
});

// Specialized model instantiation can go here
export const getGeminiModel = () => {
    // Fallback to 1.0 Pro which is most widely available
    return vertexAI.getGenerativeModel({ model: 'gemini-1.0-pro' });
};

export async function analyzeStyleWithGemini(base64Image: string): Promise<string> {
    try {
        console.log('[GEMINI] Analyzing style image...');
        const model = vertexAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

        const request = {
            contents: [{
                role: 'user',
                parts: [
                    {
                        text: "Act as an architectural expert. Analyze the handrail and staircase style in this image. Describe the materials (e.g., matte black steel, oak, glass), the geometric form (e.g., minimal, industrial, ornate), and the overall vibe. Keep it concise but detailed enough to be used as a style reference for a renovation."
                    },
                    {
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: base64Image
                        }
                    }
                ]
            }]
        };

        const result = await model.generateContent(request);
        const response = await result.response;
        const text = response.candidates?.[0].content.parts[0].text;

        console.log('[GEMINI] Analysis complete:', text?.substring(0, 50) + '...');
        return text || 'Industrial, modern, sleek metal handrail'; // Fallback
    } catch (error) {
        console.error('[GEMINI ERROR]', error);
        return 'Industrial, modern design'; // Fallback
    }
}

export async function generateDesignWithNanoBanana(
    base64TargetImage: string,
    styleInput: string | { base64StyleImage: string }
): Promise<{ success: boolean; image?: string; error?: string }> {
    try {
        console.log('[NANO BANANA] Initializing generation...');
        // "Nano Banana Pro" -> gemini-3-pro-image-preview
        const model = vertexAI.getGenerativeModel({ model: 'gemini-3-pro-image-preview' });

        const parts: any[] = [];

        // 1. Add Target Image (The stairs to redesign)
        parts.push({
            inlineData: {
                mimeType: 'image/jpeg',
                data: base64TargetImage
            }
        });

        // 2. Add Prompt details
        let prompt = "Act as a high-end architectural visualization artist. Redesign the staircase in the attached image. Maintain the exact perspective, lighting, and structural geometry of the original photo. Replace the existing handrail and stair finish with a new design. ";

        if (typeof styleInput === 'string') {
            // Text-based style
            prompt += `The new design should be in the "${styleInput}" style. Make it look photorealistic, 8k resolution.`;
        } else {
            // Image-based style
            prompt += "The new design must MATCH THE STYLE of the second attached image (Style Reference). Copy the materials, railing type, and aesthetic vibe from the reference image and apply it to the first image.";
            parts.push({
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: styleInput.base64StyleImage
                }
            });
        }

        parts.push({ text: prompt });

        const request = {
            contents: [{ role: 'user', parts }]
        };

        console.log('[NANO BANANA] Sending request to Gemini 3.0...');
        const result = await model.generateContent(request);
        const response = await result.response;

        // Gemini 3.0 Image Generation usually returns inline data differently or as a standard part.
        // Assuming standard candidate part structure for image output if supported multimodally.
        // NOTE: For 'generateContent' with image output, check for executable code or inline data.

        // Let's inspect the response structure safely
        const candidate = response.candidates?.[0];
        if (!candidate) throw new Error("No candidates returned");

        // Check for images in the parts
        for (const part of candidate.content.parts) {
            if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
                return {
                    success: true,
                    image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
                };
            }
        }

        console.warn('[NANO BANANA] Response did not contain inline image. Checking for other formats...');
        // If no image found, it might have failed or returned text.
        return { success: false, error: "Model returned text instead of image: " + candidate.content.parts[0].text?.substring(0, 100) };

    } catch (error: any) {
        console.error('[NANO BANANA ERROR]', error);
        return { success: false, error: error.message || "Unknown error during Nano Banana generation" };
    }
}

export { vertexAI };
