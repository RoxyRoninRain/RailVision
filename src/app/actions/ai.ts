'use server';



import { InputSanitizer } from '@/components/security/InputSanitizer';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
    const styleId = formData.get('styleId') as string;

    if (!file || (!style && !styleFile)) {
        return { error: 'Missing image or style reference.' };
    }

    // --- SECURITY VALIDATION ---
    const { generationSchema } = await import('@/lib/validations');
    const validationResult = generationSchema.safeParse({
        style,
        styleId: styleId || undefined, // undefined if empty string to allow optional check
        style_url: formData.get('style_url') || undefined,
        organization_id: formData.get('organization_id') || undefined
    });

    if (!validationResult.success) {
        const errorMsg = (validationResult.error as any).errors.map((e: any) => e.message).join(', ');
        return { error: `Invalid Request: ${errorMsg}` };
    }
    // ---------------------------

    // --- METERED BILLING LOGIC (START) ---
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Context for billing:
    let profileIdToBill = user?.id; // Default to logged-in user
    let shouldUseAdminClient = false;

    // Check for guest/embedded access if no user
    if (!user) {
        const organizationId = formData.get('organization_id') as string;
        if (organizationId) {
            console.log(`[AUTH] Guest access request for Tenant ID: ${organizationId}`);
            // Use tenant ID for billing
            profileIdToBill = organizationId;
            // Must use Admin Client to read/write another user's profile (since we are guest)
            shouldUseAdminClient = true;
        } else {
            return { error: 'You must be logged in to generate designs.' };
        }
    }

    // Initialize the correct client interaction
    let profileData, profileError;
    let dbClient = supabase; // Default to standard RLS client

    if (shouldUseAdminClient) {
        const adminClient = createAdminClient();
        if (!adminClient) {
            console.error('[AUTH PROVISIONING] Failed to create admin client for guest access.');
            return { error: 'System configuration error. Please contact support.' };
        }
        dbClient = adminClient;
    }

    // --- IP SECURITY CHECK ---
    const headersList = await headers();
    const clientIp = headersList.get('x-forwarded-for') || 'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    // Lazy load security actions
    const { checkIpStatus } = await import('@/app/admin/actions/security');
    // Pass profileIdToBill (Tenant ID) to check for tenant-specific blocks
    const ipStatus = await checkIpStatus(clientIp, profileIdToBill);

    if (ipStatus.blocked) {
        console.warn(`[SECURITY] Blocked IP attempt: ${clientIp} for Tenant ${profileIdToBill} (${ipStatus.reason})`);
        return { error: 'Access Denied: Your IP address has been blocked by the site administrator.' };
    }
    // -------------------------


    // 1. Fetch current usage & tier details
    const { data: profile, error: dbError } = await dbClient
        .from('profiles')
        .select('tier_name, enable_overdrive, pending_overage_balance, current_usage, max_monthly_spend, current_overage_count, email, notification_state, shop_name')
        .eq('id', profileIdToBill)
        .single();

    // Lazy load pricing configs to avoid top-level await issues if any
    const { PRICING_TIERS, DEFAULT_TIER } = await import('@/config/pricing');

    if (dbError || !profile) {
        console.error('[BILLING] Profile fetch failed:', dbError);
        return { error: 'Could not fetch profile for billing check.' };
    }

    const tierName = (profile.tier_name || DEFAULT_TIER) as keyof typeof PRICING_TIERS;
    const tier = PRICING_TIERS[tierName] || PRICING_TIERS[DEFAULT_TIER];

    const currentUsage = profile.current_usage || 0;
    const allowance = tier.allowance;
    let isOverage = false;
    let overageCost = 0;

    // Track overage units (renders) for this transaction if applicable
    let transactionOverageCount = 0;

    // 2. Usage Check Logic
    const REMAINING_WARNING_THRESHOLD = 10;
    const notificationState = (profile.notification_state as any) || {};

    if (currentUsage < allowance) {
        // Within included allowance
        const remaining = allowance - (currentUsage + 1); // +1 because we are about to consume

        // --- LOW BALANCE WARNING (The "Heads Up") ---
        if (remaining === REMAINING_WARNING_THRESHOLD) {
            const now = new Date();
            // Check if already sent recently (optional, but good practice to avoid dupes if race condition)
            // Simple logic: If we hit exactly 10, send it. Database state prevents duplicate blocks?
            // But we only update DB at the end. 
            // Logic: Fire and forget email, update notification_state in the final DB update.

            console.log('[BILLING] Low Balance Threshold Hit (10 left). Sending Email...');
            try {
                const { Resend } = await import('resend');
                const { LowBalanceEmail } = await import('@/emails/LowBalanceEmail');
                const resend = new Resend(process.env.RESEND_API_KEY);

                // Fire and forget (don't await strictly to block generation, but we want to log error)
                resend.emails.send({
                    from: 'Railify <system@railify.app>',
                    to: profile.email,
                    subject: '⚠️ Balance Warning: 10 Renderings Left',
                    react: LowBalanceEmail() as React.ReactElement,
                }).then(() => console.log('[BILLING] Low Balance Email Sent'));

                notificationState.low_balance_sent_at = now.toISOString();

            } catch (emailErr) {
                console.error('[BILLING] Failed to send Low Balance email:', emailErr);
            }
        }
    } else {
        // Overage Territory
        if (!profile.enable_overdrive) {
            console.warn(`[BILLING] Soft Cap Reached. Usage: ${currentUsage}, Limit: ${allowance}. Overdrive OFF.`);

            // --- NOTIFICATION & ERROR UX ---
            const now = new Date();
            let errorMessage = '';

            if (user) {
                // Scenario A: Tenant (Logged In)
                errorMessage = 'Monthly allowance reached. Enable Overdrive in settings to continue.';

                // Send Limit Reached Email (The "Stop")
                // Check if sent recently (e.g., in the last 24 hours) to prevent spamming on every click
                const lastSent = notificationState.limit_reached_sent_at ? new Date(notificationState.limit_reached_sent_at) : null;
                const hoursSinceLast = lastSent ? (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60) : 999;

                if (hoursSinceLast > 24) {
                    try {
                        const { Resend } = await import('resend');
                        const { LimitReachedEmail } = await import('@/emails/LimitReachedEmail');
                        const resend = new Resend(process.env.RESEND_API_KEY);

                        await resend.emails.send({
                            from: 'Railify <system@railify.app>',
                            to: profile.email,
                            subject: '⛔ Limit Reached: Action Required',
                            react: LimitReachedEmail() as React.ReactElement,
                        });

                        // We must update DB state here because we return early (error)
                        await dbClient.from('profiles').update({
                            notification_state: { ...notificationState, limit_reached_sent_at: now.toISOString() }
                        }).eq('id', profileIdToBill);

                        console.log('[BILLING] Limit Reached Email Sent to Tenant.');
                    } catch (e) { console.error('Email error:', e); }
                }

            } else {
                // Scenario B: Guest (Public/Embed)
                // UX: Generic "High Demand" error
                errorMessage = 'This tool is currently experiencing high demand. Please try again later.';

                // Send Lost Lead Alert (The "Money Saver") -- CRITICAL
                // Rate Limit: 1 per hour
                const lastLostLead = notificationState.lost_lead_sent_at ? new Date(notificationState.lost_lead_sent_at) : null;
                const hoursSinceLostLead = lastLostLead ? (now.getTime() - lastLostLead.getTime()) / (1000 * 60 * 60) : 999;

                if (hoursSinceLostLead > 1) {
                    try {
                        const { Resend } = await import('resend');
                        const { LostLeadEmail } = await import('@/emails/LostLeadEmail');
                        const resend = new Resend(process.env.RESEND_API_KEY);

                        await resend.emails.send({
                            from: 'Railify Alerts <system@railify.app>',
                            to: profile.email,
                            subject: '⚠️ Alert: You just missed a customer!',
                            react: LostLeadEmail() as React.ReactElement,
                        });

                        // Update DB state
                        await dbClient.from('profiles').update({
                            notification_state: { ...notificationState, lost_lead_sent_at: now.toISOString() }
                        }).eq('id', profileIdToBill);

                        console.log('[BILLING] Lost Lead Alert Sent to Tenant.');
                    } catch (e) { console.error('Email error:', e); }
                } else {
                    console.log('[BILLING] Lost Lead Alert Rate Limited.');
                }
            }

            return { error: errorMessage };
        }

        // Hard Cap Check (Risk Management)
        if (profile.max_monthly_spend) {
            const potentialBalance = (profile.pending_overage_balance || 0) + tier.overageRate;
            if (potentialBalance > profile.max_monthly_spend) {
                return { error: `Monthly spend limit ($${profile.max_monthly_spend}) reached. Increase limit to continue.` };
            }
        }

        isOverage = true;
        overageCost = tier.overageRate;
        transactionOverageCount = 1;

        // Report Usage to Stripe
        try {
            if (profileIdToBill) {
                const { reportUsage } = await import('@/app/actions/stripe');
                await reportUsage(profileIdToBill, 1);
                console.log(`[BILLING] Overdrive Active. Reported usage +1 to Stripe for user ${profileIdToBill}.`);
            }
        } catch (err) {
            console.error('[BILLING] Failed to report usage to Stripe:', err);
            // We continue execution; don't block the user generation for a billing glitch, 
            // but strictly we might want to? For now, fail open or soft block?
            // Since we have local pending_overage_balance tracking, we are okay to proceed.
        }
    }

    // 3. Threshold Billing Logic
    let newPendingBalance = (profile.pending_overage_balance || 0) + overageCost;
    let newOverageCount = (profile.current_overage_count || 0) + transactionOverageCount;
    let thresholdTriggered = false;

    if (isOverage && newOverageCount >= tier.billingThreshold) {
        console.warn(`[BILLING] THRESHOLD HIT! Tier: ${tier.name}, Threshold: ${tier.billingThreshold}, Count: ${newOverageCount}`);

        // TRIGGER IMMEDIATE CHARGE (Mock)
        console.log(`[PAYMENT] Charging user ${profileIdToBill} for $${newPendingBalance} (Accumulated Overage)`);

        // Reset counters after "payment"
        // Note: We reset pending balance and overage count as we just "billed" them.
        // In a real system, we'd only reset if the Stripe charge succeeds.
        newPendingBalance = 0;
        newOverageCount = 0;
        thresholdTriggered = true;
    }

    // 4. Commit Usage Update
    const { error: updateError } = await dbClient
        .from('profiles')
        .update({
            current_usage: currentUsage + 1,
            pending_overage_balance: newPendingBalance,
            current_overage_count: newOverageCount,
            notification_state: notificationState // Update state (mainly for low balance prop)
        })
        .eq('id', profileIdToBill);

    if (updateError) {
        console.error('[BILLING] Failed to update usage:', updateError);
        return { error: 'Transaction failed. Please try again.' };
    }
    // --- METERED BILLING LOGIC (END) ---

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
                    .select('reference_images, image_url')
                    .eq('id', styleId)
                    .single();

                if (styleData) {
                    // Combine Main + Hidden Refs
                    // Note: 'reference_images' (formerly gallery) might contain the main image in legacy data.
                    // New uploads separate them. Duplicates are harmless for AI vision.
                    const refs = styleData.reference_images || [];
                    const main = styleData.image_url;

                    const imageUrls: string[] = [];
                    if (main) imageUrls.push(main);
                    if (refs.length > 0) imageUrls.push(...refs);

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
            console.log(`[DEBUG] Using active dynamic prompt from DB: ${promptData.key} (ID: ${promptData.id})`);
            console.log(`[DEBUG] Negative Prompt: ${promptData.negative_prompt || 'None'}`);
        } else {
            console.warn('[DEBUG] Using default fallback prompt (DB fetch returned null or undefined). This usually means no active prompt found or DB error.');
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
                    organization_id: profileIdToBill, // Use the billed ID (User or Tenant)
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
