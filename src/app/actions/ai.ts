'use server';



import { InputSanitizer } from '@/components/security/InputSanitizer';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateDesignWithNanoBanana } from '@/lib/vertex';

const maxDuration = 120; // 2 minutes (User confirmed working limit)

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
        let errorMsg = 'Validation Failed';
        const zError = validationResult.error as any;
        if (zError && zError.errors && Array.isArray(zError.errors)) {
            errorMsg = zError.errors.map((e: any) => e.message).join(', ');
        } else if (validationResult.error instanceof Error) {
            errorMsg = validationResult.error.message;
        }
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

    // Lazy load pricing configs
    const { PRICING_TIERS, DEFAULT_TIER } = await import('@/config/pricing');

    if (dbError || !profile) {
        console.error('[BILLING] Profile fetch failed:', dbError);
        return { error: 'Could not fetch profile for billing check.' };
    }

    const tierName = (profile.tier_name || DEFAULT_TIER) as keyof typeof PRICING_TIERS;
    const tier = PRICING_TIERS[tierName] || PRICING_TIERS[DEFAULT_TIER];

    const currentUsage = profile.current_usage || 0;
    // With Utility Model, allowance is 0. All usage is metered.
    const allowance = tier.allowance || 0;
    let overageCost = 0;
    let transactionOverageCount = 0;

    // 2. Usage Check Logic (Utility Model: Always "Overdrive")
    const notificationState = (profile.notification_state as any) || {};

    // Standard Metered Logic (Applies to everyone unless allowance > 0)
    // Legacy support: If they somehow have an allowance (Unlimited Plan), we consume it first.
    if (currentUsage < allowance) {
        // --- LEGACY/UNLIMITED ALLOWANCE LOGIC ---
        // Just consume allowance, no billing.
        // (Skipping low balance warning for now as it's legacy/internal focus)
    } else {
        // --- METERED PAY-AS-YOU-GO LOGIC ---
        // Auto-enable Overdrive: We don't check profile.enable_overdrive anymore.

        overageCost = tier.overageRate;
        const currentPending = profile.pending_overage_balance || 0;
        const projectedTotal = currentPending + overageCost;

        // --- SAFETY CAP CHECK ---
        if (profile.max_monthly_spend !== null && profile.max_monthly_spend > 0) {

            // 1. HARD STOP
            if (projectedTotal > profile.max_monthly_spend) {
                console.warn(`[BILLING] Safety Cap Hit! Project: $${projectedTotal} > Limit: $${profile.max_monthly_spend}`);

                // NOTIFICATIONS (Limit Reached / Lost Lead)
                const now = new Date();

                if (user) {
                    // Scenario A: Tenant (Logged In)
                    // Check rate limit (24h)
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
                            // Update DB state regarding notification
                            await dbClient.from('profiles').update({
                                notification_state: { ...notificationState, limit_reached_sent_at: now.toISOString() }
                            }).eq('id', profileIdToBill);
                        } catch (e) { console.error('Limit Email error:', e); }
                    }
                    return { error: `Monthly spend limit ($${profile.max_monthly_spend}) reached. Increase limit to continue.` };

                } else {
                    // Scenario B: Guest (Public/Embed) - LOST LEAD
                    // Send Lost Lead Alert (1 per hour)
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
                            await dbClient.from('profiles').update({
                                notification_state: { ...notificationState, lost_lead_sent_at: now.toISOString() }
                            }).eq('id', profileIdToBill);
                        } catch (e) { console.error('Lost Lead Email error:', e); }
                    }
                    // Generic User Error
                    return { error: 'This tool is currently experiencing high demand. Please try again later.' };
                }
            }

            // 2. WARNING ALERT (Within $10)
            const remaining = profile.max_monthly_spend - currentPending;
            if (remaining <= 10 && remaining > 0) {
                const now = new Date();
                // Rate limit: One warning per month implies checking 'last_warning_month'? 
                // Or simple 24h/48h debounce. Let's do 48h to be safe.
                const lastWarn = notificationState.usage_warning_sent_at ? new Date(notificationState.usage_warning_sent_at) : null;
                const hoursSinceWarn = lastWarn ? (now.getTime() - lastWarn.getTime()) / (1000 * 60 * 60) : 999;

                if (hoursSinceWarn > 48) {
                    console.log('[BILLING] Usage Warning Triggered (Within $10)');
                    try {
                        const { Resend } = await import('resend');
                        // Dynamic import new email
                        const { UsageWarningEmail } = await import('@/emails/UsageWarningEmail');
                        const resend = new Resend(process.env.RESEND_API_KEY);

                        // Fire and forget
                        resend.emails.send({
                            from: 'Railify <system@railify.app>',
                            to: profile.email,
                            subject: '⚠️ Spending Limit Warning',
                            react: UsageWarningEmail() as React.ReactElement,
                        }).then(() => console.log('Usage Warning Sent'));

                        // Update state locally so we persist it at end of transaction
                        notificationState.usage_warning_sent_at = now.toISOString();
                    } catch (e) { console.error('Usage Warning Error:', e); }
                }
            }
        }

        // Proceed with billing accumulation
        transactionOverageCount = 1;

        // Report to Stripe (Metered Usage)
        try {
            if (profileIdToBill && tier.stripeMeteredPriceId) {
                const { reportUsage } = await import('@/app/actions/stripe');
                // We report 1 unit. Price is handled by Stripe Price ID config or subscription logic
                await reportUsage(profileIdToBill, 1);
            }
        } catch (err) {
            console.error('[BILLING] Failed to report usage to Stripe:', err);
        }
    }

    // 3. Billing Threshold Check (Charge Card)
    let newPendingBalance = (profile.pending_overage_balance || 0) + overageCost;
    let newOverageCount = (profile.current_overage_count || 0) + transactionOverageCount;

    // Check against Tier Threshold (e.g. Charge every $20 or $50)
    if (newPendingBalance >= tier.billingThreshold && tier.billingThreshold > 0) {
        console.log(`[BILLING] THRESHOLD HIT! Tier: ${tier.name}, Balance: $${newPendingBalance} >= Threshold: $${tier.billingThreshold}`);

        // TRIGGER IMMEDIATE CHARGE (Mock Implementation - In real world, this triggers Stripe Invoice Pay)
        // For now, we simulate success and reset the "Pending Bucket"
        console.log(`[PAYMENT] Auto-Charging user ${profileIdToBill} for accumulated $${newPendingBalance}`);

        // Reset counters
        newPendingBalance = 0;
        // newOverageCount = 0; // Optional: keep counting total lifetime usage? 
        // Logic says "Charge card every $20". Code earlier reset usage count too. Let's keep count for stats, but maybe reset a 'billed_units' counter?
        // Existing code reset 'current_overage_count'. I will follow suit to keep logic simple: "Usage since last bill".
        newOverageCount = 0;
    }

    // 4. Commit Usage Update
    const { error: updateError } = await dbClient
        .from('profiles')
        .update({
            current_usage: currentUsage + 1,
            pending_overage_balance: newPendingBalance,
            current_overage_count: newOverageCount,
            notification_state: notificationState
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
