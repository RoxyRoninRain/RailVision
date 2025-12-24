'use server';


import { getVertexClient, getRouterModel } from '@/lib/vertex';

const convertToJpg = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Check file type (basic check by name)
    if (file.name.toLowerCase().endsWith('.heic')) {
        console.log(`[Experimental] Converting HEIC: ${file.name}`);
        const convert = (await import('heic-convert')).default;
        const outputBuffer = await convert({
            buffer: buffer,
            format: 'JPEG',
            quality: 0.9
        });
        return Buffer.from(outputBuffer).toString('base64');
    }

    return buffer.toString('base64');
};

export async function generateExperimentalDesign(formData: FormData) {
    console.log('[Experimental] Starting 3-Step Pipeline...');
    const file = formData.get('image') as File;
    const styleFile = formData.get('style_image') as File;

    if (!file || !styleFile) return { error: 'Missing target image or style image' };

    try {
        const base64Image = await convertToJpg(file);
        const base64Style = await convertToJpg(styleFile);

        let currentImage = base64Image;
        const steps = {
            step1: { status: 'pending', result: null as any },
            step2: { status: 'pending', image: null as string | null },
            step3: { status: 'pending', image: null as string | null }
        };

        // --- STEP 1: ROUTER (Gemini 2.5 Flash-Lite) ---
        console.log('[Step 1] Analyzing image for handrails...');
        const routerRequest = {
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                    {
                        text: `Analyze this image. Does it contain a handrail, banister, or railing? 
                    Return ONLY a JSON object: { "hasHandrail": boolean, "reason": "string" }` }
                ]
            }]
        };

        const routerModel = getRouterModel(); // Lazy init

        const routerResult = await routerModel.generateContent(routerRequest);
        const routerText = routerResult.response.candidates?.[0].content.parts[0].text;

        let hasHandrail = false;
        try {
            const cleanText = routerText?.replace(/```json|```/g, '').trim() || '{}';
            const json = JSON.parse(cleanText);
            hasHandrail = json.hasHandrail;
            steps.step1 = { status: 'complete', result: json };
            console.log(`[Step 1] Analysis complete: hasHandrail=${hasHandrail}`);
        } catch (e) {
            console.error('[Step 1] Failed to parse JSON:', e);
            steps.step1 = { status: 'error', result: { hasHandrail: false, error: 'Parse failed' } };
        }

        // --- STEP 2: AUTO-DEMOLITION (Switched to Gemini 3 Pro due to Quota) ---
        if (hasHandrail) {
            console.log('[Step 2] Handrail detected. Initiating Auto-Demolition (via Gemini 3 Pro)...');
            try {
                const demolitionPrompt = "Generate an image of this scene with the handrail, banister, and railing TOTALLY REMOVED. The wall and floor behind where the handrail was should be clean and visible. Do not describe the changes, just generate the image.";

                console.log(`[Step 2] Sending request to Gemini 3 Pro (Image Size: ${base64Image.length} chars)...`);

                const demolitionRequest = {
                    contents: [{
                        role: 'user',
                        parts: [
                            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                            { text: demolitionPrompt }
                        ]
                    }]
                };

                const demolitionModel = getVertexClient(true).getGenerativeModel({
                    model: 'gemini-3-pro-image-preview',
                    systemInstruction: 'You are an expert image editor. Your ONLY task is to generate the requested image. Do not output text. Do not offer explanations. Just generate the image.'
                });
                const demolitionResult = await demolitionModel.generateContent(demolitionRequest);
                console.log('[Step 2] Gemini 3 response received.');

                const candidates = demolitionResult.response.candidates;
                const imagePart = candidates?.[0]?.content?.parts?.find(p => p.inlineData);

                if (imagePart?.inlineData) {
                    const imgPart = imagePart.inlineData;
                    currentImage = imgPart.data; // Update current image to the "Demolished" version
                    steps.step2 = { status: 'complete', image: `data:${imgPart.mimeType};base64,${imgPart.data}` };
                    console.log('[Step 2] Demolition successful.');
                } else {
                    const textPart = candidates?.[0]?.content?.parts?.map(p => p.text).join(' ') || 'Unknown';
                    console.warn('[Step 2] No image returned. Model Output:', textPart);
                    steps.step2 = { status: 'failed', image: null };
                }

            } catch (e: any) {
                console.error('[Step 2] Demolition CRITICAL FAILURE:', e.message);
                steps.step2 = { status: 'error', image: null };
            }
        } else {
            console.log('[Step 2] No handrail detected. Skipping demolition.');
            steps.step2 = { status: 'skipped', image: null };
        }

        // --- STEP 3: CONSTRUCTION (Gemini 3 Pro) ---
        console.log('[Step 3] Generating final design...');

        // Multimodal Input: Clean Plate + Style Image
        const constructionPrompt = `[Input 1: Source Space (Clean Plate)]
        [Input 2: Style Reference (New Handrail Design)]
        Task: GENERATE AN IMAGE of the Source Space with a NEW handrail installed.
        The new handrail must MATCH the style, material, and aesthetic of the Style Reference image.
        Perspective: Match the exact camera angle and lighting of the Source Space.
        Placement: Install the handrail where it logically belongs on the stairs or wall.
        OUTPUT: IMAGE ONLY.`;

        const constructionRequest = {
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: currentImage } },
                    { inlineData: { mimeType: 'image/jpeg', data: base64Style } },
                    { text: constructionPrompt }
                ]
            }]
        };

        const constructionModel = getVertexClient(true).getGenerativeModel({
            model: 'gemini-3-pro-image-preview',
            systemInstruction: 'You are an architectural visualization AI. Your goal is to generate photorealistic images of interior designs. You must always return an image. Do not provide textual descriptions or plans.'
        });
        const constructionResult = await constructionModel.generateContent(constructionRequest);
        const finalList_candidates = constructionResult.response.candidates;

        const finalImagePart = finalList_candidates?.[0]?.content?.parts?.find(p => p.inlineData);

        if (finalImagePart?.inlineData) {
            const imgPart = finalImagePart.inlineData;
            steps.step3 = { status: 'complete', image: `data:${imgPart.mimeType};base64,${imgPart.data}` };
            console.log('[Step 3] Final design generated.');
        } else {
            const textPart = finalList_candidates?.[0]?.content?.parts?.map(p => p.text).join(' ') || 'Unknown';
            console.error('[Step 3] Failed to generate image. Model Output:', textPart);
            steps.step3 = { status: 'failed', image: null };
        }

        return { success: true, steps };

    } catch (error: any) {
        console.error('[Experimental] Pipeline failed:', error);
        return { success: false, error: error.message };
    }
}
