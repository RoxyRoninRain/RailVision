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

    // --- CREDIT CONSUMPTION LOGIC (START) ---
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'You must be logged in to generate designs.' };
    }

    // 1. Fetch current credits
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('credits_monthly, credits_rollover, credits_booster, auto_boost_enabled, auto_boost_pack')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        return { error: 'Could not fetch user profile for credit check.' };
    }

    let { credits_monthly, credits_rollover, credits_booster } = profile;
    let deducted = false;

    // 2. Deduction Priority Algorithm
    // Priority 1: Monthly (Expires)
    if (credits_monthly > 0) {
        credits_monthly--;
        deducted = true;
        console.log('[CREDITS] Deducted from Monthly bucket.');
    }
    // Priority 2: Rollover (Tier 3 only)
    else if (credits_rollover > 0) {
        credits_rollover--;
        deducted = true;
        console.log('[CREDITS] Deducted from Rollover bucket.');
    }
    // Priority 3: Booster (Never Expires)
    else if (credits_booster > 0) {
        credits_booster--;
        deducted = true;
        console.log('[CREDITS] Deducted from Booster bucket.');
    }

    if (!deducted) {
        return { error: 'Insufficient credits. Please upgrade or buy a booster pack.' };
    }

    // 3. Commit Update
    const { error: updateError } = await supabase
        .from('profiles')
        .update({
            credits_monthly,
            credits_rollover,
            credits_booster
        })
        .eq('id', user.id);

    if (updateError) {
        console.error('[CREDITS] Failed to update balance:', updateError);
        // Fail open or closed? Closed for safety.
        return { error: 'Transaction failed. Please try again.' };
    }

    // 4. Auto-Boost Logic (Placeholder)
    const totalBalance = credits_monthly + credits_rollover + credits_booster;
    if (profile.auto_boost_enabled && totalBalance < 10) {
        console.log(`[AUTO-BOOST] Balance low (${totalBalance}). Triggering charge for ${profile.auto_boost_pack}... (TODO)`);
        // TODO: Call Stripe PaymentIntent -> if success -> add credits
    }
    // --- CREDIT CONSUMPTION LOGIC (END) ---

    // Server-side validation
    const validation = InputSanitizer.validate(file);
    if (!validation.valid) {
        return { error: validation.error };
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');

        let styleInput: string | { base64StyleImages: string[] } = style;
        const styleId = formData.get('styleId') as string;

        if (styleFile) {
            const styleBuffer = Buffer.from(await styleFile.arrayBuffer());
            const styleBase64 = styleBuffer.toString('base64');
            styleInput = { base64StyleImages: [styleBase64] };
            console.log('[DEBUG] Using CUSTOM Style Image for Nano Banana fusion');
        } else if (styleId) {
            // Priority 2: Check for Gallery in DB via styleId
            try {
                const supabase = await createClient();
                const { data: styleData } = await supabase
                    .from('portfolio')
                    .select('gallery, image_url')
                    .eq('id', styleId)
                    .single();

                if (styleData) {
                    const imageUrls = styleData.gallery && styleData.gallery.length > 0
                        ? styleData.gallery
                        : (styleData.image_url ? [styleData.image_url] : []);

                    if (imageUrls.length > 0) {
                        console.log(`[DEBUG] Found ${imageUrls.length} reference images in gallery/portfolio.`);
                        const styleBuffers = await Promise.all(imageUrls.map(async (url: string) => {
                            try {
                                // Handle relative public paths vs absolute URLs
                                if (url.startsWith('/')) {
                                    // Local file read
                                    const fs = await import('fs');
                                    const path = await import('path');
                                    const filePath = path.join(process.cwd(), 'public', url);
                                    if (fs.existsSync(filePath)) {
                                        return fs.readFileSync(filePath);
                                    }
                                } else {
                                    // Remote fetch
                                    const res = await fetch(url);
                                    if (res.ok) {
                                        const arrBuf = await res.arrayBuffer();
                                        return Buffer.from(arrBuf);
                                    }
                                }
                                return null;
                            } catch (e) {
                                console.warn(`[DEBUG] Failed to load style image: ${url}`, e);
                                return null;
                            }
                        }));

                        const validBase64s = styleBuffers
                            .filter(b => b !== null)
                            .map(b => b!.toString('base64'));

                        if (validBase64s.length > 0) {
                            styleInput = { base64StyleImages: validBase64s };
                            console.log(`[DEBUG] Successfully loaded ${validBase64s.length} style images for multi-shot generation.`);
                        }
                    }
                }
            } catch (dbErr) {
                console.warn('[DEBUG] Failed to fetch style gallery from DB:', dbErr);
            }
        }

        // Fallback: Check for style_url if logic above didn't set image input
        // (This handles cases where DB lookup failed or styleId wasn't passed, but style_url was)
        if (typeof styleInput === 'string') {
            const styleUrl = formData.get('style_url') as string;
            // ... existing styleUrl logic ...

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
                        styleInput = { base64StyleImages: [styleBase64] }; // Wrapped in array
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
                userTemplate: promptData.user_template,
                negative_prompt: promptData.negative_prompt
            };
            console.log('[DEBUG] Using active dynamic prompt from DB:', promptData.key);
        } else {
            console.log('[DEBUG] Using default fallback prompt (DB fetch failed or empty)');
        }

        const result = await generateDesignWithNanoBanana(base64Image, styleInput as any, promptConfig);

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
        // CRITICAL: Return the actual error to the UI instead of a silent fallback
        return { success: false, error: 'Generation Failed: ' + (error.message || 'Unknown error') };
        /*
        // Fallback for demo/dev purposes if API fails (e.g. Rate Limit or 404)
        console.warn('Returning fallback image due to generation failure.');
        return {
            success: true,
            image: '/styles/modern.png', // Fallback to a valid existing image
            isFallback: true
        };
        */
    }
}
