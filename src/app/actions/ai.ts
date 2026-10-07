'use server';



import { InputSanitizer } from '@/components/security/InputSanitizer';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateDesignWithNanoBanana } from '@/lib/vertex';

const maxDuration = 120; // 2 minutes (User confirmed working limit)

export async function convertHeicToJpg(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

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

    // --- ADMIN TEST MODE CHECK ---
    const { checkIsAdmin } = await import('@/lib/auth-utils');
    const isAdmin = await checkIsAdmin();
    const isAdminTest = isAdmin && (
        formData.get('is_admin_test') === 'true' ||
        formData.get('admin_test') === 'true'
    );

    // Context for billing:
    let profileIdToBill = user?.id; // Default to logged-in user
    let shouldUseAdminClient = false;
    let isGenericDemo = false;

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
            isGenericDemo = true;
        }
    } else if (isAdminTest) {
        // Admin testing a specific tenant
        const targetTenantId = (formData.get('organization_id') as string) || (formData.get('tenant_id') as string);
        if (targetTenantId) {
            profileIdToBill = targetTenantId;
            shouldUseAdminClient = true;
        }
        console.log(`[ADMIN TEST] Running in Zero-Charge Admin Test Mode for Tenant ID: ${profileIdToBill}`);
    }

    // Initialize the correct client interaction
    let profileData, profileError;
    let dbClient = supabase; // Default to standard RLS client

    if (shouldUseAdminClient) {
        const adminClient = createAdminClient();
        if (!adminClient) {
            console.error('[AUTH PROVISIONING] Failed to create admin client.');
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

    if (ipStatus.blocked && !isAdminTest) {
        console.warn(`[SECURITY] Blocked IP attempt: ${clientIp} for Tenant ${profileIdToBill} (${ipStatus.reason})`);
        return { error: 'Access Denied: Your IP address has been blocked by the site administrator.' };
    }
    // -------------------------

    // --- AUTO RATE LIMITER (20/hr) ---
    // Bypassed for verified admin tests to support onboarding and troubleshooting
    if (!isAdminTest && clientIp !== 'unknown') {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count, error: rlError } = await dbClient
            .from('generations')
            .select('*', { count: 'exact', head: true })
            .eq('ip_address', clientIp)
            .gte('created_at', oneHourAgo);
            
        if (!rlError && count !== null && count >= 20) {
            console.warn(`[SECURITY] Auto Rate Limit Triggered: IP ${clientIp} exceeded 20 generations/hr.`);
            return { error: 'You have reached the maximum allowed generations (20 per hour). Please try again later.' };
        }
    }
    // ---------------------------------

    // 1. Fetch current usage & tier details
    let profile: any = null;
    let dbError: any = null;
    
    if (!isGenericDemo && profileIdToBill) {
        const res = await dbClient
            .from('profiles')
            .select('tier_name, enable_overdrive, pending_overage_balance, current_usage, max_monthly_spend, current_overage_count, email, notification_state, shop_name, website, subscription_status, free_credits_remaining, discounted_credits_remaining, discounted_rate, pending_discounted_amount, pending_discounted_count')
            .eq('id', profileIdToBill)
            .single();
        profile = res.data;
        dbError = res.error;
    }

    // Lazy load pricing configs
    const { PRICING_TIERS, DEFAULT_TIER } = await import('@/config/pricing');

    // Only enforce active subscription for public/tenant usage, not admin test mode
    if (!isGenericDemo && !isAdminTest) {
        if (dbError || !profile) {
            console.error('[BILLING] Profile fetch failed:', dbError);
            return { error: 'Could not fetch profile for billing check.' };
        }

        if (profile.subscription_status !== 'active') {
            return { error: 'Service Unavailable: The account associated with this tool is not currently active.' };
        }
    }

    const tierName = profile ? (profile.tier_name || DEFAULT_TIER) as keyof typeof PRICING_TIERS : DEFAULT_TIER;
    const tier = PRICING_TIERS[tierName] || PRICING_TIERS[DEFAULT_TIER];

    const currentUsage = profile?.current_usage || 0;
    // With Utility Model, allowance is 0. All usage is metered.
    const allowance = tier?.allowance || 0;
    let overageCost = 0;
    let transactionOverageCount = 0;

    // 2. Usage Check Logic (Utility Model: Always "Overdrive")
    const notificationState = profile ? (profile.notification_state as any) || {} : {};

    const freeCredits = Number(profile?.free_credits_remaining) || 0;
    const discountedCredits = Number(profile?.discounted_credits_remaining) || 0;
    let isFreeCreditUsed = false;
    let isDiscountedCreditUsed = false;

    if (isGenericDemo || isAdminTest) {
        // Skip billing: Generic demo or Admin Test Mode (Zero charges for tenant)
        console.log(`[BILLING] Bypassing billing - ${isAdminTest ? 'Admin Test Mode (Zero Usage Charges)' : 'Generic Demo'}`);
    } else if (freeCredits > 0) {
        // --- 1. FREE CREDITS FIRST (Used before any discounted or full price credits) ---
        isFreeCreditUsed = true;
        overageCost = 0;
        transactionOverageCount = 0;
        console.log(`[BILLING] Consuming FREE credit for ${profileIdToBill}. Remaining after this run: ${freeCredits - 1}`);
    } else if (discountedCredits > 0) {
        // --- 2. DISCOUNTED CREDITS SECOND (50% promotional rate: e.g. $0.40 Volume, $0.50 Pro) ---
        isDiscountedCreditUsed = true;
        const rate = profile?.discounted_rate ? Number(profile.discounted_rate) : (tier.overageRate * 0.5);
        overageCost = rate;
        transactionOverageCount = 0; // Not counted as a full-price standard overage
        console.log(`[BILLING] Consuming DISCOUNTED credit ($${rate.toFixed(2)}) for ${profileIdToBill}. Remaining after this run: ${discountedCredits - 1}`);

        const currentPending = (profile.pending_overage_balance || 0);
        const projectedTotal = currentPending + overageCost;

        // Safety cap check
        if (profile.max_monthly_spend !== null && profile.max_monthly_spend > 0) {
            if (projectedTotal > profile.max_monthly_spend) {
                console.warn(`[BILLING] Safety Cap Hit! Projected: $${projectedTotal} > Limit: $${profile.max_monthly_spend}`);
                return { error: `Monthly spend limit ($${profile.max_monthly_spend}) reached. Increase limit to continue.` };
            }
        }
        // Note: We DO NOT report to Stripe metered price here, because Stripe metered price would charge full $0.80 or $1.00.
        // Instead, pending_discounted_amount is tracked and added as an invoice item on the monthly renewal.
    } else if (currentUsage < allowance) {
        // --- LEGACY/UNLIMITED ALLOWANCE LOGIC ---
        // Just consume allowance, no billing.
    } else {
        // --- 3. FULL PRICE CREDITS (Standard Metered Pay-As-You-Go) ---
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
                            await dbClient.from('profiles').update({
                                notification_state: { ...notificationState, limit_reached_sent_at: now.toISOString() }
                            }).eq('id', profileIdToBill);
                        } catch (e) { console.error('Limit Email error:', e); }
                    }
                    return { error: `Monthly spend limit ($${profile.max_monthly_spend}) reached. Increase limit to continue.` };
                } else {
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
                    return { error: 'This tool is currently experiencing high demand. Please try again later.' };
                }
            }

            // 2. WARNING ALERT (Within $10)
            const remaining = profile.max_monthly_spend - currentPending;
            if (remaining <= 10 && remaining > 0) {
                const now = new Date();
                const lastWarn = notificationState.usage_warning_sent_at ? new Date(notificationState.usage_warning_sent_at) : null;
                const hoursSinceWarn = lastWarn ? (now.getTime() - lastWarn.getTime()) / (1000 * 60 * 60) : 999;

                if (hoursSinceWarn > 48) {
                    console.log('[BILLING] Usage Warning Triggered (Within $10)');
                    try {
                        const { Resend } = await import('resend');
                        const { UsageWarningEmail } = await import('@/emails/UsageWarningEmail');
                        const resend = new Resend(process.env.RESEND_API_KEY);

                        resend.emails.send({
                            from: 'Railify <system@railify.app>',
                            to: profile.email,
                            subject: '⚠️ Spending Limit Warning',
                            react: UsageWarningEmail() as React.ReactElement,
                        }).then(() => console.log('Usage Warning Sent'));

                        notificationState.usage_warning_sent_at = now.toISOString();
                    } catch (e) { console.error('Usage Warning Error:', e); }
                }
            }
        }

        // Proceed with standard billing accumulation
        transactionOverageCount = 1;

        // Report to Stripe (Metered Usage) ONLY for standard full-price designs
        try {
            if (profileIdToBill && tier.stripeMeteredPriceId) {
                const { reportUsage } = await import('@/app/actions/stripe');
                await reportUsage(profileIdToBill, 1);
            }
        } catch (err) {
            console.error('[BILLING] Failed to report usage to Stripe:', err);
        }
    }

    // 3. Billing Threshold Check (Charge Card for standard usage)
    let newPendingBalance = (profile?.pending_overage_balance || 0) + overageCost;
    let newOverageCount = (profile?.current_overage_count || 0) + transactionOverageCount;

    // Check against Tier Threshold (e.g. Charge every $20 or $50) for standard usage
    if (!isGenericDemo && !isAdminTest && !isFreeCreditUsed && !isDiscountedCreditUsed && tier && newPendingBalance >= tier.billingThreshold && tier.billingThreshold > 0) {
        console.log(`[BILLING] THRESHOLD HIT! Tier: ${tier.name}, Balance: $${newPendingBalance} >= Threshold: $${tier.billingThreshold}`);
        newPendingBalance = 0;
        newOverageCount = 0;
    }

    // 4. Commit Usage & Credit Updates
    if (!isGenericDemo && !isAdminTest) {
        const updatePayload: any = {
            current_usage: currentUsage + 1,
            pending_overage_balance: newPendingBalance,
            current_overage_count: newOverageCount,
            notification_state: notificationState
        };

        if (isFreeCreditUsed) {
            updatePayload.free_credits_remaining = Math.max(0, freeCredits - 1);
        } else if (isDiscountedCreditUsed) {
            updatePayload.discounted_credits_remaining = Math.max(0, discountedCredits - 1);
            updatePayload.pending_discounted_amount = parseFloat(((Number(profile?.pending_discounted_amount) || 0) + overageCost).toFixed(2));
            updatePayload.pending_discounted_count = (Number(profile?.pending_discounted_count) || 0) + 1;
        }

        const { error: updateError } = await dbClient
            .from('profiles')
            .update(updatePayload)
            .eq('id', profileIdToBill);

        if (updateError) {
            console.error('[BILLING] Failed to update usage:', updateError);
            return { error: 'Transaction failed. Please try again.' };
        }
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

        let styleInput: string | { 
            base64StyleImages: string[]; 
            technicalSpecs?: { 
                hasBottomRail?: boolean; 
                hasReducers?: boolean | null;
                postMount?: 'top' | 'side' | string;
                description?: string; 
                customNote?: string;
            } 
        } = style;
        const styleId = formData.get('styleId') as string;
        const styleDescription = formData.get('style_description') as string;
        const rawPrompt = formData.get('prompt') as string;
        const customPromptNote = (formData.get('custom_prompt_note') as string) ||
            (rawPrompt && rawPrompt !== "High quality architectural photorealistic render" ? rawPrompt : undefined);

        let secondPassConfig: { enabled: boolean; targets: string[]; custom_prompt?: string; detail_images?: Record<string, string> } | null = null;

        if (styleFile) {
            const styleBuffer = Buffer.from(await styleFile.arrayBuffer());
            const styleBase64 = styleBuffer.toString('base64');
            const formBottomRail = formData.get('has_bottom_rail');
            const formReducers = formData.get('has_reducers');
            const formPostMount = formData.get('post_mount') as string;
            styleInput = { 
                base64StyleImages: [styleBase64],
                technicalSpecs: {
                    hasBottomRail: (formBottomRail !== null && formBottomRail !== undefined && formBottomRail !== '') ? formBottomRail === 'true' : undefined,
                    hasReducers: (formReducers !== null && formReducers !== undefined && formReducers !== '') ? formReducers === 'true' : undefined,
                    postMount: (formPostMount === 'side' || formPostMount === 'top') ? formPostMount : undefined,
                    description: styleDescription || undefined,
                    customNote: customPromptNote?.trim() || undefined
                }
            };
            console.log('[DEBUG] Using CUSTOM Style Image for Nano Banana fusion');
        } else if (styleId) {
            // Priority 2: Check for Gallery in DB via styleId
            try {
                const styleLookupClient = (isAdminTest || shouldUseAdminClient) ? (createAdminClient() || supabase) : supabase;
                const { data: styleData } = await styleLookupClient
                    .from('portfolio')
                    .select('*')
                    .eq('id', styleId)
                    .single();

                if (styleData) {
                    if (styleData.style_metadata?.second_pass) {
                        secondPassConfig = {
                            enabled: styleData.style_metadata.second_pass.enabled === true,
                            targets: Array.isArray(styleData.style_metadata.second_pass.targets) ? styleData.style_metadata.second_pass.targets : [],
                            custom_prompt: styleData.style_metadata.second_pass.custom_prompt || undefined,
                            detail_images: styleData.style_metadata.second_pass.detail_images || undefined
                        };
                    }

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
                            const formBottomRail = formData.get('has_bottom_rail');
                            const hasBottomRailFinal = (formBottomRail !== null && formBottomRail !== undefined && formBottomRail !== '')
                                ? formBottomRail === 'true'
                                : styleData.has_bottom_rail;

                            const formReducers = formData.get('has_reducers');
                            const hasReducersFinal = (formReducers !== null && formReducers !== undefined && formReducers !== '')
                                ? formReducers === 'true'
                                : styleData.has_reducers;

                            const formPostMount = formData.get('post_mount') as string;
                            const postMountFinal = (formPostMount === 'side' || formPostMount === 'top')
                                ? formPostMount
                                : (styleData.post_mount || styleData.style_metadata?.post_mount || 'top');

                            styleInput = {
                                base64StyleImages: validBase64s,
                                technicalSpecs: {
                                    hasBottomRail: hasBottomRailFinal,
                                    hasReducers: hasReducersFinal,
                                    postMount: postMountFinal,
                                    description: styleDescription || styleData.description,
                                    customNote: customPromptNote?.trim() || undefined
                                }
                            };
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
                        const formBottomRail = formData.get('has_bottom_rail');
                        const formReducers = formData.get('has_reducers');
                        const formPostMount = formData.get('post_mount') as string;
                        styleInput = { 
                            base64StyleImages: [styleBase64],
                            technicalSpecs: {
                                hasBottomRail: (formBottomRail !== null && formBottomRail !== undefined && formBottomRail !== '') ? formBottomRail === 'true' : undefined,
                                hasReducers: (formReducers !== null && formReducers !== undefined && formReducers !== '') ? formReducers === 'true' : undefined,
                                postMount: (formPostMount === 'side' || formPostMount === 'top') ? formPostMount : undefined,
                                description: styleDescription || undefined,
                                customNote: customPromptNote?.trim() || undefined
                            }
                        };
                        console.log(`[DEBUG] Successfully loaded style image for Nano Banana fusion`);
                    } else {
                        console.warn('[DEBUG] Could not load style image from URL, falling back to text.');
                    }

                } catch (err) {
                    console.error('[DEBUG] Error processing style URL:', err);
                }
            } else {
                console.log('[DEBUG] No style visuals found. Using Style Text only:', style);
                const formPostMount = formData.get('post_mount') as string;
                if (customPromptNote || styleDescription || formPostMount) {
                    styleInput = {
                        base64StyleImages: [],
                        technicalSpecs: {
                            postMount: (formPostMount === 'side' || formPostMount === 'top') ? formPostMount : undefined,
                            description: styleDescription || style,
                            customNote: customPromptNote?.trim() || undefined
                        }
                    };
                }
            }
        }

        // Check for explicit formData overrides for second pass
        const formSkipSecondPass = formData.get('skip_second_pass');
        if (formSkipSecondPass === 'true') {
            if (secondPassConfig) secondPassConfig.enabled = false;
        }
        const formEnableSecondPass = formData.get('enable_second_pass');
        if (formEnableSecondPass === 'true') {
            if (!secondPassConfig) secondPassConfig = { enabled: true, targets: [] };
            secondPassConfig.enabled = true;
        } else if (formEnableSecondPass === 'false') {
            if (secondPassConfig) secondPassConfig.enabled = false;
        }
        const formSecondPassTargets = formData.get('second_pass_targets') as string;
        if (formSecondPassTargets) {
            try {
                const parsed = JSON.parse(formSecondPassTargets);
                if (Array.isArray(parsed)) {
                    if (!secondPassConfig) secondPassConfig = { enabled: true, targets: [] };
                    secondPassConfig.targets = parsed;
                }
            } catch {
                const parsed = formSecondPassTargets.split(',').map(s => s.trim()).filter(Boolean);
                if (!secondPassConfig) secondPassConfig = { enabled: true, targets: [] };
                secondPassConfig.targets = parsed;
            }
        }
        const formSecondPassCustomPrompt = formData.get('second_pass_custom_prompt') as string;
        if (formSecondPassCustomPrompt !== null && formSecondPassCustomPrompt !== undefined) {
            if (!secondPassConfig) secondPassConfig = { enabled: true, targets: [] };
            secondPassConfig.custom_prompt = formSecondPassCustomPrompt.trim();
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

            // --- SECOND-PASS AI REFINEMENT ---
            let secondPassApplied = false;
            if (secondPassConfig?.enabled && (secondPassConfig.targets?.length > 0 || secondPassConfig.custom_prompt)) {
                console.log('[DEBUG] Executing Second-Pass AI Refinement with targets:', secondPassConfig.targets);
                try {
                    const { assembleRefinementPrompt, refineDesignWithNanoBanana } = await import('@/lib/vertex');
                    const { SECOND_PASS_ISSUES } = await import('@/app/actions/types');
                    const refinementPrompt = assembleRefinementPrompt(secondPassConfig);
                    if (refinementPrompt) {
                        // Gather close-up detail images for active targets
                        const detailImagesForPass2: { targetId: string; label: string; base64Data: string }[] = [];
                        if (secondPassConfig.detail_images) {
                            for (const targetId of secondPassConfig.targets) {
                                const imgUrl = secondPassConfig.detail_images[targetId];
                                if (imgUrl) {
                                    try {
                                        const res = await fetch(imgUrl);
                                        if (res.ok) {
                                            const buf = Buffer.from(await res.arrayBuffer());
                                            const issueMeta = SECOND_PASS_ISSUES.find(i => i.id === targetId);
                                            detailImagesForPass2.push({
                                                targetId,
                                                label: issueMeta?.uploadLabel || targetId,
                                                base64Data: buf.toString('base64')
                                            });
                                        }
                                    } catch (fetchErr) {
                                        console.warn(`Failed to fetch second pass detail image for ${targetId}:`, fetchErr);
                                    }
                                }
                            }
                        }

                        const refImagesForPass2 = (typeof styleInput !== 'string' && styleInput.base64StyleImages && styleInput.base64StyleImages.length > 1)
                            ? styleInput.base64StyleImages.slice(1)
                            : undefined;

                        const pass2Result = await refineDesignWithNanoBanana(
                            result.image, 
                            refinementPrompt, 
                            refImagesForPass2,
                            detailImagesForPass2.length > 0 ? detailImagesForPass2 : undefined
                        );
                        if (pass2Result.success && pass2Result.image) {
                            console.log('[DEBUG] Second-Pass Refinement completed successfully!');
                            result.image = pass2Result.image;
                            secondPassApplied = true;
                            if (pass2Result.usage && result.usage) {
                                result.usage.inputTokens += pass2Result.usage.inputTokens;
                                result.usage.outputTokens += pass2Result.usage.outputTokens;
                            }
                        } else {
                            console.warn('[DEBUG] Second-Pass Refinement returned no image or failed, keeping Pass 1 image:', pass2Result.error);
                        }
                    }
                } catch (pass2Err) {
                    console.error('[DEBUG] Error executing Second-Pass Refinement, keeping Pass 1 image:', pass2Err);
                }
            }

            // --- TRACKING START (Added for Admin Stats) ---
            try {
                const trackingClient = (isAdminTest || shouldUseAdminClient) ? (createAdminClient() || supabase) : supabase;

                // Capture Analytics
                const headersList = await headers();
                const ip = headersList.get('x-forwarded-for') || 'unknown';
                const userAgent = headersList.get('user-agent') || 'unknown';

                const promptTag = isAdminTest
                    ? `[ADMIN_TEST] ${promptConfig ? 'Dynamic Prompt' : 'Default Prompt'}${secondPassApplied ? ' + Second-Pass' : ''}`
                    : `${promptConfig ? 'Dynamic Prompt' : 'Default Prompt'}${secondPassApplied ? ' + Second-Pass' : ''}`;

                await trackingClient.from('generations').insert([{
                    organization_id: profileIdToBill, // Use the tenant ID being tested
                    image_url: result.image.startsWith('data:') ? 'Base64 Image Data' : result.image,
                    prompt_used: promptTag,
                    style_id: style,
                    ip_address: ip,
                    user_agent: userAgent,
                    created_at: new Date().toISOString(),
                    // COST TRACKING
                    model_id: 'gemini-3.1-flash-image',
                    input_tokens: result.usage?.inputTokens || 0,
                    output_tokens: result.usage?.outputTokens || 0
                }]);
                console.log('[DEBUG] Generation tracked in DB with IP:', ip);
            } catch (err) {
                console.warn('[Tracking] Failed to log generation:', err);
            }
            // --- TRACKING END ---

            return { 
                success: true, 
                image: result.image,
                isAdminTest: !!isAdminTest,
                usage: result.usage,
                secondPassApplied
            };
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
