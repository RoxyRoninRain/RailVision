'use server';

import { InputSanitizer } from '@/components/security/InputSanitizer';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { generateDesignWithNanoBanana } from '@/lib/vertex';

export async function convertHeicToJpg(formData: FormData) {
    console.log('[Server Action] Converting HEIC to JPG (using heic-convert)...');
    try {
        const file = formData.get('file') as File;
        if (!file) throw new Error('No file provided');

        const buffer = Buffer.from(await file.arrayBuffer());

        // Dynamically import heic-convert (Pure JS, no native bindings issues)
        const convert = (await import('heic-convert')).default;

        const outputBuffer = await convert({
            buffer: buffer,
            format: 'JPEG',      // output format
            quality: 0.9         // quality matches previous sharp setting
        });

        // outputBuffer is a Buffer (JPEG bytes)
        return {
            success: true,
            base64: `data:image/jpeg;base64,${Buffer.from(outputBuffer).toString('base64')}`
        };
    } catch (error: any) {
        console.error('[Server Action] HEIC conversion error:', error);
        return { success: false, error: 'Conversion failed: ' + error.message };
    }
}

export async function generateDesign(formData: FormData) {
    console.log('[DEBUG] generateDesign (NANO BANANA MODE) called');
    const file = formData.get('image') as File;
    const style = formData.get('style') as string;
    const styleFile = formData.get('style_image') as File;

    if (!file || (!style && !styleFile)) {
        return { error: 'Missing image or style reference.' };
    }

    // Server-side validation
    const validation = InputSanitizer.validate(file);
    if (!validation.valid) {
        return { error: validation.error };
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');

        let styleInput: string | { base64StyleImage: string } = style;

        if (styleFile) {
            const styleBuffer = Buffer.from(await styleFile.arrayBuffer());
            const styleBase64 = styleBuffer.toString('base64');
            styleInput = { base64StyleImage: styleBase64 };
            console.log('[DEBUG] Using CUSTOM Style Image for Nano Banana fusion');
        } else {
            // Priority 2: Check for style_url (Preset or DB-loaded style)
            const styleUrl = formData.get('style_url') as string;

            if (styleUrl) {
                try {
                    let styleBuffer: Buffer | null = null;

                    if (styleUrl.startsWith('http')) {
                        console.log(`[DEBUG] Fetching remote style image: ${styleUrl}`);
                        const response = await fetch(styleUrl);
                        if (!response.ok) throw new Error(`Failed to fetch style image: ${response.statusText}`);
                        const arrayBuffer = await response.arrayBuffer();
                        styleBuffer = Buffer.from(arrayBuffer);
                    } else if (styleUrl.startsWith('/')) {
                        console.log(`[DEBUG] Loading local style image: ${styleUrl}`);
                        const fs = await import('fs');
                        const path = await import('path');
                        const filePath = path.join(process.cwd(), 'public', styleUrl);
                        if (fs.existsSync(filePath)) {
                            styleBuffer = fs.readFileSync(filePath);
                        } else {
                            console.warn(`[DEBUG] Local file not found: ${filePath}`);
                        }
                    }

                    if (styleBuffer) {
                        const styleBase64 = styleBuffer.toString('base64');
                        styleInput = { base64StyleImage: styleBase64 };
                        console.log(`[DEBUG] Successfully loaded style image for Nano Banana fusion`);
                    } else {
                        console.warn('[DEBUG] Could not load style image from URL, falling back to text.');
                    }

                } catch (err) {
                    console.error('[DEBUG] Error processing style URL:', err);
                }
            } else {
                console.log('[DEBUG] No style visuals found. Using Style Text only:', style);
            }
        }

        // 1. Fetch dynamic prompt configuration
        // Dynamic import to avoid circular dependency loop if admin actions import this file? 
        // Or simply separation of concerns.
        const { getActiveSystemPrompt } = await import('@/app/admin/actions');
        const promptData = await getActiveSystemPrompt();

        let promptConfig = undefined;
        if (promptData) {
            promptConfig = {
                systemInstruction: promptData.system_instruction,
                userTemplate: promptData.user_template
            };
            console.log('[DEBUG] Using active dynamic prompt from DB:', promptData.key);
        } else {
            console.log('[DEBUG] Using default fallback prompt (DB fetch failed or empty)');
        }

        const result = await generateDesignWithNanoBanana(base64Image, styleInput, promptConfig);

        if (result.success && result.image) {
            console.log('[DEBUG] Image generated successfully with Nano Banana');

            // --- TRACKING START (Added for Admin Stats) ---
            try {
                // Determine Org ID if logged in (for attribution)
                const supabase = await createClient();
                const { data: { user } } = await supabase.auth.getUser();

                // Capture Analytics
                const headersList = await headers();
                const ip = headersList.get('x-forwarded-for') || 'unknown';
                const userAgent = headersList.get('user-agent') || 'unknown';

                await supabase.from('generations').insert([{
                    organization_id: user ? user.id : null,
                    image_url: result.image.startsWith('data:') ? 'Base64 Image Data' : result.image,
                    prompt_used: promptConfig ? 'Dynamic Prompt' : 'Default Prompt',
                    style_id: style,
                    ip_address: ip,
                    user_agent: userAgent,
                    created_at: new Date().toISOString(),
                    // COST TRACKING
                    model_id: 'gemini-3.0-pro-image-preview',
                    input_tokens: result.usage?.inputTokens || 0,
                    output_tokens: result.usage?.outputTokens || 0
                }]);
                console.log('[DEBUG] Generation tracked in DB with IP:', ip);
            } catch (err) {
                console.warn('[Tracking] Failed to log generation:', err);
            }
            // --- TRACKING END ---

            return { success: true, image: result.image };
        } else {
            throw new Error(result.error || 'Unknown Nano Banana error');
        }

    } catch (error: any) {
        console.error('[ERROR] Generation Failed:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        // Fallback for demo/dev purposes if API fails (e.g. Rate Limit or 404)
        console.warn('Returning fallback image due to generation failure.');
        return {
            success: true,
            image: '/styles/modern.png', // Fallback to a valid existing image
            isFallback: true
        };
        // return { error: 'Failed to generate image. ' + (error.message || 'Unknown error') };
    }
}
