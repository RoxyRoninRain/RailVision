'use server';

import { createClient } from '@/lib/supabase/server';
import { generateDesignWithNanoBanana } from '@/lib/vertex';

export async function runBulkTest(formData: FormData) {
    console.log('[Bulk Test] Starting generation request...');

    // 1. Admin Authentication Check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    // Ideally check for specific admin role here, assuming verified admin for now due to route protection

    // 2. Parse Inputs
    const targetFile = formData.get('target_image') as File;
    const styleFile = formData.get('style_image') as File; // Optional if using text only? User asked for upload.

    // Prompts
    const systemPrompt = formData.get('system_prompt') as string;
    const userPromptTemplate = formData.get('user_prompt') as string;
    const negativePrompt = formData.get('negative_prompt') as string;

    // Toggles
    const mountStyle = formData.get('mount_style') as string;
    const postStyle = formData.get('post_style') as string;
    const terminationStyle = formData.get('termination_style') as string;

    if (!targetFile) return { error: 'Target Image is required' };

    try {
        // 3. Prepare Images
        // Target
        const targetBuffer = Buffer.from(await targetFile.arrayBuffer());
        const base64Target = targetBuffer.toString('base64');

        // Style
        let styleInput: any = "No style image provided";
        if (styleFile && styleFile.size > 0) {
            const styleBuffer = Buffer.from(await styleFile.arrayBuffer());
            const base64Style = styleBuffer.toString('base64');
            styleInput = {
                base64StyleImages: [base64Style],
                technicalSpecs: {
                    mountStyle,
                    postStyle,
                    terminationStyle
                }
            };
        } else {
            // If no style image, we still pass specs? 
            // vertex.ts expects styleInput object to hold specs.
            // If styleInput is string, it ignores specs! 
            // We need to force an object even if no image? 
            // The vertex.ts types say: styleInput: string | { base64StyleImages: string[]; technicalSpecs?: ... }
            // If we want to test specs WITHOUT style image (e.g. text style + toggles), we might need to verify vertex.ts support.
            // Looking at vertex.ts: 
            // "if (typeof styleInput === 'string') { console.log('[DEBUG] Text-only style, skipping Image B/C slots'); }"
            // AND dynamic logic block: "if (typeof styleInput !== 'string' && styleInput.technicalSpecs) {"
            // So if we pass string, we LOSE the specs.
            // We must pass an object. If no style image, maybe pass empty array?
            // Vertex logic: "const styleImages = styleInput.base64StyleImages; if (styleImages.length > 0) { ... }"
            // So empty array is safe for logic.
            styleInput = {
                base64StyleImages: [],
                technicalSpecs: {
                    mountStyle,
                    postStyle,
                    terminationStyle
                }
            };
        }

        // 4. Prepare Configuration
        const promptConfig = {
            systemInstruction: systemPrompt,
            userTemplate: userPromptTemplate,
            negative_prompt: negativePrompt
        };

        // 5. Execute
        const result = await generateDesignWithNanoBanana(base64Target, styleInput, promptConfig);

        if (result.success) {
            return { success: true, image: result.image, usage: result.usage };
        } else {
            return { success: false, error: result.error };
        }

    } catch (e: any) {
        console.error('[Bulk Test Error]', e);
        return { success: false, error: e.message };
    }
}
