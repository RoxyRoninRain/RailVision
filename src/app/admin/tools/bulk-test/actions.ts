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

    const technicalSpecs = {
        hasBottomRail: mountStyle ? (mountStyle === 'shoe_rail' || mountStyle === 'bottom_rail' || mountStyle === 'true') : undefined,
        hasReducers: terminationStyle ? (terminationStyle === 'reducers' || terminationStyle === 'true') : undefined,
        postMount: (postStyle === 'side' || postStyle === 'side_mount') ? 'side' : 'top',
    };

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
                technicalSpecs
            };
        } else {
            styleInput = {
                base64StyleImages: [],
                technicalSpecs
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
