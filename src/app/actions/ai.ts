'use server';

import { InputSanitizer } from '@/components/security/InputSanitizer';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateDesignWithNanoBanana } from '@/lib/vertex';
import { calculateGenerationCostUsd } from '@/lib/model-pricing';
import { applyServerWatermark, pixelLockCompositeBackground } from '@/lib/image-compositor';
import type { FabricationSpec, SceneRouterAnalysis, StyleSlotId, VisionQaResult } from '@/app/actions/types';
import {
    detectImageMetadata,
    INTERNAL_PROMPT_TOKEN,
    isSafeExternalUrl,
    isTrustedAppHost,
    safeFetchImageBuffer,
} from '@/lib/validations';
import { checkRateLimit, extractClientIp } from '@/lib/rate-limit';

function getOptionalModuleFn<T>(mod: unknown, exportName: string): T | undefined {
    try {
        const candidate = (mod as Record<string, unknown>)?.[exportName];
        return typeof candidate === 'function' ? (candidate as T) : undefined;
    } catch {
        return undefined;
    }
}

async function readSafePublicFile(relativeUrl: string): Promise<Buffer | null> {
    if (!relativeUrl.startsWith('/') || relativeUrl.startsWith('//') || relativeUrl.includes('\0')) {
        return null;
    }
    const fs = await import('fs');
    const path = await import('path');
    const publicRoot = path.resolve(process.cwd(), 'public');
    const resolvedPath = path.resolve(publicRoot, '.' + relativeUrl);
    if (!resolvedPath.startsWith(publicRoot + path.sep)) {
        console.warn(`[SECURITY] Blocked path traversal attempt: ${relativeUrl}`);
        return null;
    }
    if (fs.existsSync(resolvedPath)) {
        return fs.readFileSync(resolvedPath);
    }
    return null;
}

function isOriginAllowedForTenant(originOrReferer: string | null, websiteWhitelist: string | null | undefined): boolean {
    if (!originOrReferer) return true;
    try {
        const parsed = new URL(originOrReferer);
        if (isTrustedAppHost(parsed.host)) {
            return true;
        }
        const currentDomain = parsed.hostname.replace(/^www\./i, '').toLowerCase();
        if (currentDomain === 'mississippimetalmagic.com') {
            return true;
        }
        if (!websiteWhitelist) {
            return true;
        }
        const allowedDomains = websiteWhitelist
            .split(',')
            .map((d) => d.trim().replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '').toLowerCase())
            .filter(Boolean);

        return allowedDomains.some(
            (allowed) => currentDomain === allowed || currentDomain.endsWith('.' + allowed)
        );
    } catch {
        return false;
    }
}

export async function convertHeicToJpg(formData: FormData) {
    try {
        const headersList = await headers();
        const clientIp = extractClientIp(headersList);
        const rl = checkRateLimit('heic-convert', clientIp, 15, 10 * 60 * 1000);
        if (!rl.allowed) {
            return { success: false, error: 'Too many image conversions. Please wait a few minutes and try again.' };
        }

        const file = formData.get('file') as File;
        if (!file) {
            return { success: false, error: 'No file provided' };
        }
        if (file.size > 15 * 1024 * 1024) {
            return { success: false, error: 'File too large (max 15MB)' };
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const meta = detectImageMetadata(buffer, { allowHeic: true });
        if (!meta.valid) {
            return { success: false, error: 'Unsupported or invalid image format.' };
        }

        // If the browser sent an already-decoded raster image with a .heic extension, return it directly
        if (meta.mimeType && meta.mimeType !== 'image/heic') {
            return {
                success: true,
                base64: `data:${meta.mimeType};base64,${buffer.toString('base64')}`
            };
        }

        // Dynamically import heic-convert (Pure JS, no native bindings issues)
        const convert = (await import('heic-convert')).default;

        const outputBuffer = await convert({
            buffer: buffer as any,
            format: 'JPEG',      // output format
            quality: 0.9         // high quality to preserve staircase edge details
        });

        return {
            success: true,
            base64: `data:image/jpeg;base64,${Buffer.from(outputBuffer).toString('base64')}`
        };
    } catch (error: any) {
        console.error('[Server Action] HEIC conversion error:', error);
        return { success: false, error: 'Unable to convert HEIC photo. Please try a JPG or PNG image.' };
    }
}

export async function generateDesign(formData: FormData) {
    const file = formData.get('image') as File;
    const style = formData.get('style') as string;
    const styleFile = formData.get('style_image') as File;
    const styleId = formData.get('styleId') as string;

    if (!file || (!style && !styleFile)) {
        return { error: 'Missing image or style reference.' };
    }

    // --- SECURITY VALIDATION ---
    const rawStyleUrl = (formData.get('style_url') as string) || undefined;
    if (rawStyleUrl && !rawStyleUrl.startsWith('http') && (!rawStyleUrl.startsWith('/styles/') || rawStyleUrl.includes('..'))) {
        return { error: 'Invalid Request: Unsafe style_url path' };
    }

    const { generationSchema } = await import('@/lib/validations');
    const validationResult = generationSchema.safeParse({
        style: style || 'Custom Style',
        styleId: styleId || undefined,
        style_url: rawStyleUrl && rawStyleUrl.startsWith('http') ? rawStyleUrl : undefined,
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

    // Server-side MIME + size + magic-byte validation upfront before any billing or DB mutations
    const validation = InputSanitizer.validate(file);
    if (!validation.valid) {
        return { error: validation.error };
    }

    const targetArrayBuffer = await file.arrayBuffer();
    const targetBuffer = Buffer.from(targetArrayBuffer);
    const targetMagicCheck = InputSanitizer.validateBuffer(targetBuffer);
    if (!targetMagicCheck.valid) {
        return { error: targetMagicCheck.error };
    }

    let uploadedStyleBuffer: Buffer | null = null;
    if (styleFile && styleFile.size > 0) {
        const styleValidation = InputSanitizer.validate(styleFile);
        if (!styleValidation.valid) {
            return { error: styleValidation.error };
        }
        uploadedStyleBuffer = Buffer.from(await styleFile.arrayBuffer());
        const styleMagicCheck = InputSanitizer.validateBuffer(uploadedStyleBuffer);
        if (!styleMagicCheck.valid) {
            return { error: styleMagicCheck.error };
        }
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
    }

    // Only authenticated admins or the owning tenant may inject custom prompt directives,
    // override technical specs, upload raw custom style files, or force extra refinement passes.
    const canOverridePromptAndSpecs = isAdmin || Boolean(user && profileIdToBill && user.id === profileIdToBill);

    const adminClientInstance = createAdminClient();
    let dbClient = supabase; // Default to standard RLS client

    if (shouldUseAdminClient) {
        if (!adminClientInstance) {
            console.error('[AUTH PROVISIONING] Failed to create admin client.');
            return { error: 'System configuration error. Please contact support.' };
        }
        dbClient = adminClientInstance;
    }

    // Always use Admin Client (when available) for IP rate-limiting & telemetry queries on `generations`
    // because RLS on `generations` hides rows from `anon` callers, which would otherwise return count = 0.
    const rateLimitDbClient = adminClientInstance || dbClient;

    // --- IP SECURITY CHECK ---
    const headersList = await headers();
    const clientIp = extractClientIp(headersList);
    const userAgent = headersList.get('user-agent') || 'unknown';

    // Lazy load security actions
    const { checkIpStatus } = await import('@/app/admin/actions/security');
    const ipStatus = await checkIpStatus(clientIp, profileIdToBill);

    if (ipStatus.blocked && !isAdminTest) {
        console.warn(`[SECURITY] Blocked IP attempt: ${clientIp} for Tenant ${profileIdToBill} (${ipStatus.reason})`);
        return { error: 'Access Denied: Your IP address has been blocked by the site administrator.' };
    }
    // -------------------------

    // --- AUTO RATE LIMITER (5/hr for unauthenticated Generic Demo, 20/hr for Tenant Widgets) ---
    if (!isAdminTest) {
        const maxHourlyGenerations = isGenericDemo ? 5 : 20;

        // In-memory burst check closes the concurrent TOCTOU window while Vertex AI is still running
        if (clientIp !== 'unknown') {
            const burstCheck = checkRateLimit(
                isGenericDemo ? 'ai-gen-generic' : 'ai-gen-tenant',
                clientIp,
                maxHourlyGenerations,
                60 * 60 * 1000
            );
            if (!burstCheck.allowed) {
                return {
                    error: `You have reached the maximum allowed generations (${maxHourlyGenerations} per hour). Please try again later.`
                };
            }
        }

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count, error: rlError } = await rateLimitDbClient
            .from('generations')
            .select('*', { count: 'exact', head: true })
            .eq('ip_address', clientIp)
            .gte('created_at', oneHourAgo);

        if (!rlError && count !== null && count >= maxHourlyGenerations) {
            console.warn(`[SECURITY] Auto Rate Limit Triggered: IP ${clientIp} exceeded ${maxHourlyGenerations} generations/hr.`);
            return {
                error: `You have reached the maximum allowed generations (${maxHourlyGenerations} per hour). Please try again later.`
            };
        }
    }
    // ---------------------------------

    // 1. Fetch current usage & tier details
    let profile: any = null;
    let dbError: any = null;

    if (!isGenericDemo && profileIdToBill) {
        const res = await dbClient
            .from('profiles')
            .select('tier_name, enable_overdrive, pending_overage_balance, current_usage, max_monthly_spend, current_overage_count, email, notification_state, shop_name, website, subscription_status, free_credits_remaining, discounted_credits_remaining, discounted_rate, pending_discounted_amount, pending_discounted_count, logo_url, watermark_logo_url, logo_size')
            .eq('id', profileIdToBill)
            .single();
        profile = res.data;
        dbError = res.error;
    }

    // Lazy load pricing configs
    const { PRICING_TIERS, DEFAULT_TIER } = await import('@/config/pricing');

    // Only enforce active subscription & domain origin check for public/tenant usage, not admin test mode
    if (!isGenericDemo && !isAdminTest) {
        if (dbError || !profile) {
            console.error('[BILLING] Profile fetch failed:', dbError);
            return { error: 'Could not fetch profile for billing check.' };
        }

        if (profile.subscription_status !== 'active' && profile.subscription_status !== 'trialing') {
            return { error: 'Service Unavailable: The account associated with this tool is not currently active.' };
        }

        if (!user && profile.website) {
            const originHeader = headersList.get('origin') || headersList.get('referer');
            if (!isOriginAllowedForTenant(originHeader, profile.website)) {
                console.warn(`[SECURITY] Blocked cross-origin widget call from ${originHeader} for tenant ${profileIdToBill}`);
                return { error: 'Unauthorized origin for this embedded visualizer.' };
            }
        }
    }

    const rawTierName = String(profile?.tier_name || DEFAULT_TIER).toLowerCase();
    const matchedTierKey = (Object.keys(PRICING_TIERS) as Array<keyof typeof PRICING_TIERS>).find(k => k.toLowerCase() === rawTierName) || (rawTierName.includes('volume') ? 'Volume' : rawTierName.includes('pro') ? 'Professional' : rawTierName.includes('unlimited') ? 'The Unlimited' : DEFAULT_TIER);
    const tierName = matchedTierKey;
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
    } else if (freeCredits > 0) {
        // --- 1. FREE CREDITS FIRST (Used before any discounted or full price credits) ---
        isFreeCreditUsed = true;
        overageCost = 0;
        transactionOverageCount = 0;
    } else if (discountedCredits > 0) {
        // --- 2. DISCOUNTED CREDITS SECOND (50% promotional rate: e.g. $0.40 Volume, $0.50 Pro) ---
        isDiscountedCreditUsed = true;
        const rate = profile?.discounted_rate ? Number(profile.discounted_rate) : (tier.overageRate * 0.5);
        overageCost = rate;
        transactionOverageCount = 0; // Not counted as a full-price standard overage

        const currentPending = Number(profile.pending_overage_balance) || 0;
        const cumulativeOverageSpend = ((Number(profile.current_overage_count) || 0) * tier.overageRate) + (Number(profile.pending_discounted_amount) || 0);
        const projectedTotal = Math.max(currentPending, cumulativeOverageSpend) + overageCost;

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
        const currentPending = Number(profile.pending_overage_balance) || 0;
        const cumulativeOverageSpend = ((Number(profile.current_overage_count) || 0) * tier.overageRate) + (Number(profile.pending_discounted_amount) || 0);
        const effectiveCurrentSpend = Math.max(currentPending, cumulativeOverageSpend);
        const projectedTotal = effectiveCurrentSpend + overageCost;

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
            const remaining = profile.max_monthly_spend - effectiveCurrentSpend;
            if (remaining <= 10 && remaining > 0) {
                const now = new Date();
                const lastWarn = notificationState.usage_warning_sent_at ? new Date(notificationState.usage_warning_sent_at) : null;
                const hoursSinceWarn = lastWarn ? (now.getTime() - lastWarn.getTime()) / (1000 * 60 * 60) : 999;

                if (hoursSinceWarn > 48) {
                    try {
                        const { Resend } = await import('resend');
                        const { UsageWarningEmail } = await import('@/emails/UsageWarningEmail');
                        const resend = new Resend(process.env.RESEND_API_KEY);

                        resend.emails.send({
                            from: 'Railify <system@railify.app>',
                            to: profile.email,
                            subject: '⚠️ Spending Limit Warning',
                            react: UsageWarningEmail() as React.ReactElement,
                        }).catch((e) => console.error('Usage Warning Error:', e));

                        notificationState.usage_warning_sent_at = now.toISOString();
                    } catch (e) { console.error('Usage Warning Error:', e); }
                }
            }
        }

        // Proceed with standard billing accumulation
        transactionOverageCount = 1;
    }

    // 3. Accumulate Overage Balance (Billed & reset once a month on subscription renewal payment)
    const newPendingBalance = parseFloat(((Number(profile?.pending_overage_balance) || 0) + overageCost).toFixed(2));
    const newOverageCount = (Number(profile?.current_overage_count) || 0) + transactionOverageCount;

    // 4. Prepare Usage & Credit Updates (Committed ONLY after generation succeeds)
    const shouldReportStripeUsage = !isGenericDemo && !isAdminTest && !isFreeCreditUsed && !isDiscountedCreditUsed && currentUsage >= allowance && !!(profileIdToBill && tier?.stripeMeteredPriceId);
    let billingUpdatePayload: any = null;
    if (!isGenericDemo && !isAdminTest) {
        billingUpdatePayload = {
            current_usage: currentUsage + 1,
            pending_overage_balance: newPendingBalance,
            current_overage_count: newOverageCount,
            notification_state: notificationState
        };

        if (isFreeCreditUsed) {
            billingUpdatePayload.free_credits_remaining = Math.max(0, freeCredits - 1);
        } else if (isDiscountedCreditUsed) {
            billingUpdatePayload.discounted_credits_remaining = Math.max(0, discountedCredits - 1);
            billingUpdatePayload.pending_discounted_amount = parseFloat(((Number(profile?.pending_discounted_amount) || 0) + overageCost).toFixed(2));
            billingUpdatePayload.pending_discounted_count = (Number(profile?.pending_discounted_count) || 0) + 1;
        }
    }
    // --- METERED BILLING PREPARATION (END) ---

    try {
        const base64Image = targetBuffer.toString('base64');

        let styleInput: any = style;

        const styleDescription = canOverridePromptAndSpecs ? (formData.get('style_description') as string) : undefined;
        const rawPrompt = canOverridePromptAndSpecs ? (formData.get('prompt') as string) : undefined;
        const customPromptNote = canOverridePromptAndSpecs
            ? ((formData.get('custom_prompt_note') as string) ||
                (rawPrompt && rawPrompt !== "High quality architectural photorealistic render" ? rawPrompt : undefined))
            : undefined;

        let secondPassConfig: { enabled: boolean; targets: string[]; custom_prompt?: string; detail_images?: Record<string, string> } | null = null;
        const urlToBase64Map = new Map<string, string>();
        let loadedLabeledSlots: { slotId: StyleSlotId; base64Data: string }[] | undefined;

        const fetchStyleUrlToBase64 = async (url: string): Promise<string | null> => {
            if (urlToBase64Map.has(url)) return urlToBase64Map.get(url) || null;
            try {
                let buf: Buffer | null = null;
                if (url.startsWith('/')) {
                    buf = await readSafePublicFile(url);
                } else if (isSafeExternalUrl(url)) {
                    buf = await safeFetchImageBuffer(url);
                } else {
                    console.warn(`[SECURITY] Blocked unsafe style URL: ${url}`);
                }
                if (buf) {
                    const b64 = buf.toString('base64');
                    urlToBase64Map.set(url, b64);
                    return b64;
                }
                return null;
            } catch (e) {
                console.warn(`[DEBUG] Failed to load style image: ${url}`, e);
                return null;
            }
        };

        if (uploadedStyleBuffer && canOverridePromptAndSpecs) {
            const styleBase64 = uploadedStyleBuffer.toString('base64');
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
        } else if (styleId) {
            // Priority 2: Check for Gallery in DB via styleId
            try {
                const styleLookupClient = (isAdminTest || shouldUseAdminClient) ? (adminClientInstance || supabase) : supabase;
                const { data: styleData } = await styleLookupClient
                    .from('portfolio')
                    .select('*')
                    .eq('id', styleId)
                    .single();

                if (styleData) {
                    // Prevent cross-tenant style IDOR and inactive draft access for public widget callers
                    if (!isAdmin && profileIdToBill && styleData.tenant_id && styleData.tenant_id !== profileIdToBill) {
                        return { error: 'Invalid Request: Selected style does not belong to this organization.' };
                    }
                    if (!canOverridePromptAndSpecs && styleData.is_active === false) {
                        return { error: 'Invalid Request: Selected style is not currently active.' };
                    }

                    const meta = styleData.style_metadata || {};
                    const fabricationSpec: FabricationSpec | null = meta.fabrication_spec || null;
                    const labeledSlotsMap = meta.labeled_slots as Partial<Record<StyleSlotId, string[]>> | undefined;
                    const useCanonicalCutout = meta.use_canonical_cutout === true && Boolean(meta.canonical_image_url);

                    if (meta.second_pass) {
                        secondPassConfig = {
                            enabled: meta.second_pass.enabled === true,
                            targets: Array.isArray(meta.second_pass.targets) ? meta.second_pass.targets : [],
                            custom_prompt: meta.second_pass.custom_prompt || undefined,
                            detail_images: meta.second_pass.detail_images || undefined
                        };
                    }

                    const orderedSlots: { slotId: StyleSlotId; url: string }[] = [];
                    if (labeledSlotsMap && Object.keys(labeledSlotsMap).length > 0) {
                        const slotOrder: StyleSlotId[] = [
                            'hero_run',
                            'post_top_joint',
                            'post_mount_base',
                            'infill_bottom',
                            'end_return',
                            'finish_macro',
                            'extra_context',
                        ];
                        for (const slotId of slotOrder) {
                            const urls = labeledSlotsMap[slotId];
                            if (!Array.isArray(urls)) continue;
                            urls.forEach((u, idx) => {
                                if (typeof u === 'string' && u) {
                                    const resolvedUrl =
                                        slotId === 'hero_run' && idx === 0 && useCanonicalCutout
                                            ? meta.canonical_image_url
                                            : u;
                                    orderedSlots.push({ slotId, url: resolvedUrl });
                                }
                            });
                        }
                    }

                    const refs: string[] = Array.isArray(styleData.reference_images) ? styleData.reference_images : [];
                    const primaryHeroUrl: string | undefined = useCanonicalCutout
                        ? meta.canonical_image_url
                        : styleData.image_url;

                    const imageUrls = orderedSlots.length > 0
                        ? Array.from(new Set(orderedSlots.map((s) => s.url)))
                        : Array.from(new Set([primaryHeroUrl, ...refs].filter((u): u is string => Boolean(u && typeof u === 'string'))));

                    if (imageUrls.length > 0) {
                        const loadedResults = await Promise.all(
                            imageUrls.map(async (url) => ({ url, base64: await fetchStyleUrlToBase64(url) }))
                        );

                        const validBase64s = loadedResults
                            .map((r) => r.base64)
                            .filter((b): b is string => b !== null);

                        if (orderedSlots.length > 0) {
                            const resolvedLabeled = orderedSlots
                                .map((item) => {
                                    const b64 = urlToBase64Map.get(item.url);
                                    return b64 ? { slotId: item.slotId, base64Data: b64 } : null;
                                })
                                .filter((x): x is { slotId: StyleSlotId; base64Data: string } => x !== null);
                            if (resolvedLabeled.length > 0) {
                                loadedLabeledSlots = resolvedLabeled;
                            }
                        }

                        if (validBase64s.length > 0) {
                            const formBottomRail = canOverridePromptAndSpecs ? formData.get('has_bottom_rail') : null;
                            const hasBottomRailFinal = (formBottomRail !== null && formBottomRail !== undefined && formBottomRail !== '')
                                ? formBottomRail === 'true'
                                : (styleData.has_bottom_rail ?? fabricationSpec?.has_bottom_rail);

                            const formReducers = canOverridePromptAndSpecs ? formData.get('has_reducers') : null;
                            const hasReducersFinal = (formReducers !== null && formReducers !== undefined && formReducers !== '')
                                ? formReducers === 'true'
                                : (styleData.has_reducers ??
                                    (fabricationSpec?.post_to_rail_joint === 'stem_reducer'
                                        ? true
                                        : fabricationSpec?.post_to_rail_joint === 'direct_flush_weld'
                                          ? false
                                          : styleData.has_reducers));

                            const formPostMount = canOverridePromptAndSpecs ? (formData.get('post_mount') as string) : null;
                            const postMountFinal = (formPostMount === 'side' || formPostMount === 'top')
                                ? formPostMount
                                : (styleData.post_mount ||
                                    meta.post_mount ||
                                    (fabricationSpec?.post_mount_type === 'side' || fabricationSpec?.post_mount_type === 'top'
                                        ? fabricationSpec.post_mount_type
                                        : fabricationSpec?.post_mount_type === 'wall'
                                          ? undefined
                                          : 'top'));

                            styleInput = {
                                base64StyleImages: validBase64s,
                                ...(loadedLabeledSlots ? { labeledSlotImages: loadedLabeledSlots } : {}),
                                technicalSpecs: {
                                    hasBottomRail: hasBottomRailFinal,
                                    hasReducers: hasReducersFinal,
                                    postMount: postMountFinal,
                                    description: styleDescription || styleData.description,
                                    customNote: customPromptNote?.trim() || undefined,
                                    fabricationSpec,
                                }
                            };
                        }
                    }
                }
            } catch (dbErr) {
                console.warn('[DEBUG] Failed to fetch style gallery from DB:', dbErr);
            }
        }

        // Fallback: Check for style_url if logic above didn't set image input
        if (typeof styleInput === 'string') {
            const styleUrl = formData.get('style_url') as string;

            if (styleUrl) {
                try {
                    let styleBuffer: Buffer | null = null;

                    if (styleUrl.startsWith('http')) {
                        if (!isSafeExternalUrl(styleUrl)) {
                            throw new Error('Blocked unsafe remote style URL');
                        }
                        styleBuffer = await safeFetchImageBuffer(styleUrl);
                    } else if (styleUrl.startsWith('/')) {
                        styleBuffer = await readSafePublicFile(styleUrl);
                    }

                    if (styleBuffer) {
                        const styleBase64 = styleBuffer.toString('base64');
                        const formBottomRail = canOverridePromptAndSpecs ? formData.get('has_bottom_rail') : null;
                        const formReducers = canOverridePromptAndSpecs ? formData.get('has_reducers') : null;
                        const formPostMount = canOverridePromptAndSpecs ? (formData.get('post_mount') as string) : null;
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
                    }
                } catch (err) {
                    console.error('[DEBUG] Error processing style URL:', err);
                }
            } else if (canOverridePromptAndSpecs) {
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

        // Only allow authenticated admins / owning shop owners to override Pass 2 configuration via FormData
        if (canOverridePromptAndSpecs) {
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
        }

        // If Pass 2 is enabled without explicit targets or custom_prompt, automatically derive
        // accurate audit targets matching `SECOND_PASS_ISSUES` IDs from the active style's technicalSpecs.
        if (secondPassConfig?.enabled && (!secondPassConfig.targets || secondPassConfig.targets.length === 0) && !secondPassConfig.custom_prompt) {
            const derivedTargets: string[] = [];
            const activeSpecs = typeof styleInput !== 'string' ? styleInput.technicalSpecs : undefined;
            if (activeSpecs) {
                if (activeSpecs.hasBottomRail === true) {
                    derivedTargets.push('shoe_rail');
                } else if (activeSpecs.hasBottomRail === false) {
                    derivedTargets.push('direct_mount');
                }

                // `reducers` removes standoff pins for flush welds (`hasReducers === false`),
                // whereas `reducer_fittings` preserves intentional stem collars (`hasReducers === true`).
                if (activeSpecs.hasReducers === false) {
                    derivedTargets.push('reducers');
                } else if (activeSpecs.hasReducers === true) {
                    derivedTargets.push('reducer_fittings');
                }

                if (activeSpecs.postMount === 'side') {
                    derivedTargets.push('side_mount');
                } else if (activeSpecs.postMount === 'top') {
                    derivedTargets.push('top_mount');
                }
            }
            if (derivedTargets.length === 0) {
                derivedTargets.push('reducers', 'top_mount');
            }
            secondPassConfig.targets = derivedTargets;
        }

        // 1. Fetch dynamic prompt configuration using internal server-only token
        const { getActiveSystemPrompt } = await import('@/app/admin/actions');
        const promptData = await getActiveSystemPrompt(INTERNAL_PROMPT_TOKEN);

        let promptConfig = undefined;
        if (promptData) {
            promptConfig = {
                systemInstruction: promptData.system_instruction,
                userTemplate: promptData.user_template,
                negative_prompt: promptData.negative_prompt ?? undefined
            };
        }

        // 2. Scene Router + Cached Clean Plate Demolition (when Vertex vision helpers are loaded)
        const vertexMod = await import('@/lib/vertex');
        const analyzeFn = getOptionalModuleFn<typeof import('@/lib/vertex').analyzeSceneWithRouter>(vertexMod, 'analyzeSceneWithRouter');
        const cleanPlateFn = getOptionalModuleFn<typeof import('@/lib/vertex').getOrCreateCleanPlate>(vertexMod, 'getOrCreateCleanPlate');
        const visionQaFn = getOptionalModuleFn<typeof import('@/lib/vertex').verifyRenderQualityWithVisionQA>(vertexMod, 'verifyRenderQualityWithVisionQA');
        const getModelIdFn = getOptionalModuleFn<typeof import('@/lib/vertex').getConfiguredImageModelId>(vertexMod, 'getConfiguredImageModelId');
        const assemblePromptFn = getOptionalModuleFn<typeof import('@/lib/vertex').assembleRefinementPrompt>(vertexMod, 'assembleRefinementPrompt');
        const refineFn = getOptionalModuleFn<typeof import('@/lib/vertex').refineDesignWithNanoBanana>(vertexMod, 'refineDesignWithNanoBanana');
        const fallbackModelId = (getModelIdFn ? getModelIdFn() : (process.env.VERTEX_IMAGE_MODEL?.trim() || 'gemini-nano-banana-2.1'));

        let auxiliaryCostUsd = 0;
        let sceneAnalysis: SceneRouterAnalysis | null = null;
        let targetCanvasBase64 = base64Image;
        let hasCleanPlate = false;

        if (analyzeFn) {
            try {
                const routerRes = await analyzeFn(base64Image);
                sceneAnalysis = routerRes.analysis;
                auxiliaryCostUsd += calculateGenerationCostUsd({
                    modelId: routerRes.modelUsed,
                    inputTokens: routerRes.usage?.inputTokens,
                    outputTokens: routerRes.usage?.outputTokens,
                    imageCount: 0,
                });
            } catch (routerErr) {
                console.warn('[SCENE ROUTER] Non-fatal analysis bypass:', routerErr);
            }
        }

        if (cleanPlateFn) {
            try {
                const cleanRes = await cleanPlateFn(base64Image, sceneAnalysis);
                if (cleanRes?.didDemolish && cleanRes.cleanPlateBase64) {
                    targetCanvasBase64 = cleanRes.cleanPlateBase64;
                    hasCleanPlate = true;
                }
                if (cleanRes?.modelUsed && !cleanRes.cached) {
                    auxiliaryCostUsd += calculateGenerationCostUsd({
                        modelId: cleanRes.modelUsed,
                        inputTokens: cleanRes.usage?.inputTokens,
                        outputTokens: cleanRes.usage?.outputTokens,
                        imageCount: 1,
                        imageSize: '1K',
                    });
                }
            } catch (cleanErr) {
                console.warn('[CLEAN PLATE] Non-fatal bypass:', cleanErr);
            }
        }

        if (typeof styleInput !== 'string') {
            styleInput.technicalSpecs = {
                ...(styleInput.technicalSpecs || {}),
                ...(sceneAnalysis ? { sceneAnalysis } : {}),
                ...(hasCleanPlate ? { hasCleanPlate } : {}),
            };
        }

        const result = await generateDesignWithNanoBanana(targetCanvasBase64, styleInput as any, promptConfig);

        if (result.success && result.image) {
            // --- COMMIT BILLING & CREDITS AFTER SUCCESSFUL GENERATION ---
            let atomicCreditResult: { used_metered?: boolean } | null = null;

            if (billingUpdatePayload && profileIdToBill) {
                const rpcClient = adminClientInstance || dbClient;
                let committedViaRpc = false;

                if (typeof (rpcClient as any).rpc === 'function') {
                    try {
                        const { data: rpcData, error: rpcError } = await (rpcClient as any).rpc('consume_generation_credit', {
                            p_profile_id: profileIdToBill,
                            p_overage_rate: tier.overageRate,
                            p_allowance: allowance,
                            p_notification_state: notificationState,
                        });

                        if (!rpcError && rpcData && rpcData.allowed === true) {
                            committedViaRpc = true;
                            atomicCreditResult = rpcData;
                        } else if (!rpcError && rpcData && rpcData.allowed === false) {
                            return { error: rpcData.reason || 'Monthly spend limit reached.' };
                        }
                    } catch {
                        // Fall back cleanly if the RPC migration has not been applied yet
                    }
                }

                if (!committedViaRpc) {
                    const { error: updateError } = await dbClient
                        .from('profiles')
                        .update(billingUpdatePayload)
                        .eq('id', profileIdToBill);

                    if (updateError) {
                        console.error('[BILLING] Failed to update usage:', updateError);
                        return { error: 'Transaction failed. Please try again.' };
                    }
                }
            }

            const shouldReportStripeFinal = atomicCreditResult
                ? Boolean(atomicCreditResult.used_metered && profileIdToBill && tier?.stripeMeteredPriceId)
                : shouldReportStripeUsage;

            if (shouldReportStripeFinal && profileIdToBill) {
                try {
                    const { reportUsage } = await import('@/app/actions/stripe');
                    await reportUsage(profileIdToBill, 1);
                } catch (err) {
                    console.error('[BILLING] Failed to report usage to Stripe:', err);
                }
            }
            // ------------------------------------------------------------

            // --- AGENTIC VISION QA + CONDITIONAL STATEFUL PASS 2 REFINEMENT ---
            let secondPassApplied = false;
            const explicitSkipSecondPass = canOverridePromptAndSpecs && formData.get('skip_second_pass') === 'true';
            const adminForcedSecondPass = canOverridePromptAndSpecs && formData.get('enable_second_pass') === 'true';

            let visionQaResult: VisionQaResult | null = null;
            const detailImagesForPass2: { targetId: string; label: string; base64Data: string }[] = [];
            const { SECOND_PASS_ISSUES } = await import('@/app/actions/types');

            const preloadDetailImages = async (targetIds: string[]) => {
                if (secondPassConfig?.detail_images) {
                    for (const targetId of targetIds) {
                        if (detailImagesForPass2.some((d) => d.targetId === targetId)) continue;
                        const imgUrl = secondPassConfig.detail_images[targetId];
                        if (!imgUrl) continue;
                        const cachedB64 = urlToBase64Map.get(imgUrl);
                        if (cachedB64) {
                            const issueMeta = SECOND_PASS_ISSUES.find(i => i.id === targetId);
                            detailImagesForPass2.push({ targetId, label: issueMeta?.uploadLabel || targetId, base64Data: cachedB64 });
                        } else if (isSafeExternalUrl(imgUrl)) {
                            const buf = await safeFetchImageBuffer(imgUrl);
                            if (buf) {
                                const b64 = buf.toString('base64');
                                urlToBase64Map.set(imgUrl, b64);
                                const issueMeta = SECOND_PASS_ISSUES.find(i => i.id === targetId);
                                detailImagesForPass2.push({ targetId, label: issueMeta?.uploadLabel || targetId, base64Data: b64 });
                            }
                        }
                    }
                }
                if (loadedLabeledSlots) {
                    const slotMap: { slotId: StyleSlotId; targetId: string; label: string }[] = [
                        { slotId: 'post_top_joint', targetId: 'reducers', label: 'Post-to-Rail Joint Close-Up' },
                        { slotId: 'post_mount_base', targetId: 'post_mount_base', label: 'Post Mount Base Close-Up' },
                        { slotId: 'infill_bottom', targetId: 'infill_bottom', label: 'Infill & Bottom Termination Close-Up' },
                        { slotId: 'end_return', targetId: 'end_return', label: 'End / Corner Return Close-Up' },
                    ];
                    for (const m of slotMap) {
                        if (detailImagesForPass2.some((d) => d.targetId === m.targetId)) continue;
                        const hit = loadedLabeledSlots.find((s) => s.slotId === m.slotId);
                        if (hit) {
                            detailImagesForPass2.push({ targetId: m.targetId, label: m.label, base64Data: hit.base64Data });
                        }
                    }
                }
            };

            const initialTargets = secondPassConfig?.targets || [];
            await preloadDetailImages(initialTargets);

            if (!explicitSkipSecondPass && visionQaFn && typeof styleInput !== 'string') {
                try {
                    const qaRes = await visionQaFn({
                        originalSceneBase64: targetCanvasBase64,
                        renderedImageBase64: result.image,
                        styleImages: styleInput.base64StyleImages || [],
                        detailImages: detailImagesForPass2,
                        specs: {
                            hasBottomRail: styleInput.technicalSpecs?.hasBottomRail,
                            postMount: (styleInput.technicalSpecs?.postMount as 'top' | 'side' | null | undefined) ?? null,
                            hasReducers: styleInput.technicalSpecs?.hasReducers,
                            fabricationSpec: styleInput.technicalSpecs?.fabricationSpec,
                        },
                    });
                    visionQaResult = qaRes.qa;
                    auxiliaryCostUsd += calculateGenerationCostUsd({
                        modelId: qaRes.modelUsed,
                        inputTokens: qaRes.usage?.inputTokens,
                        outputTokens: qaRes.usage?.outputTokens,
                        imageCount: 0,
                    });
                } catch (qaErr) {
                    console.warn('[VISION QA] Non-fatal bypass:', qaErr);
                }
            }

            let shouldRunPass2 = false;
            if (!explicitSkipSecondPass) {
                if (visionQaResult) {
                    shouldRunPass2 =
                        !visionQaResult.passed ||
                        (visionQaResult.railing_fidelity_score ?? 100) < 88 ||
                        adminForcedSecondPass ||
                        Boolean(secondPassConfig?.custom_prompt);
                } else {
                    shouldRunPass2 = Boolean(
                        secondPassConfig?.enabled &&
                        ((secondPassConfig.targets && secondPassConfig.targets.length > 0) || secondPassConfig.custom_prompt)
                    );
                }
            }

            if (shouldRunPass2 && refineFn) {
                try {
                    const mergedTargets = Array.from(
                        new Set([
                            ...(secondPassConfig?.targets || []),
                            ...(visionQaResult?.suggested_targets || []),
                        ])
                    );
                    await preloadDetailImages(mergedTargets);

                    let refinementPrompt = assemblePromptFn
                        ? assemblePromptFn({
                            targets: mergedTargets,
                            custom_prompt: secondPassConfig?.custom_prompt,
                            post_mount: (typeof styleInput !== 'string' ? (styleInput.technicalSpecs?.postMount as 'top' | 'side' | undefined) : undefined),
                            detail_images: secondPassConfig?.detail_images,
                        })
                        : (secondPassConfig?.custom_prompt || '');
                    if (!refinementPrompt && visionQaResult?.surgical_fix_instructions) {
                        refinementPrompt = `Perform a targeted surgical refinement on this railing photograph while keeping the room and stairs 100% locked:\n${visionQaResult.surgical_fix_instructions}`;
                    }

                    if (refinementPrompt) {
                        const refImagesForPass2 = (typeof styleInput !== 'string' && styleInput.base64StyleImages && styleInput.base64StyleImages.length > 0)
                            ? styleInput.base64StyleImages.slice(0, 4)
                            : undefined;

                        const hasMultiTurnState = Boolean((result as any).assistantTurnContent && (result as any).initialUserParts);
                        const pass2Result = hasMultiTurnState
                            ? await refineFn(
                                result.image,
                                refinementPrompt,
                                refImagesForPass2,
                                detailImagesForPass2.length > 0 ? detailImagesForPass2 : undefined,
                                targetCanvasBase64,
                                {
                                    initialUserParts: (result as any).initialUserParts,
                                    assistantTurnContent: (result as any).assistantTurnContent,
                                    qaInstructions: visionQaResult?.surgical_fix_instructions,
                                }
                            )
                            : await refineFn(
                                result.image,
                                refinementPrompt,
                                refImagesForPass2,
                                detailImagesForPass2.length > 0 ? detailImagesForPass2 : undefined,
                                targetCanvasBase64
                            );

                        if (pass2Result.success && pass2Result.image) {
                            result.image = pass2Result.image;
                            secondPassApplied = true;
                            if (pass2Result.usage && result.usage) {
                                result.usage.inputTokens += pass2Result.usage.inputTokens;
                                result.usage.outputTokens += pass2Result.usage.outputTokens;
                            }
                            auxiliaryCostUsd += calculateGenerationCostUsd({
                                modelId: pass2Result.modelUsed || result.modelUsed || fallbackModelId,
                                inputTokens: pass2Result.usage?.inputTokens,
                                outputTokens: pass2Result.usage?.outputTokens,
                                imageCount: 1,
                                imageSize: result.imageSize || '2K',
                            });
                        } else {
                            console.warn('[DEBUG] Second-Pass Refinement returned no image or failed, keeping Pass 1 image:', pass2Result.error);
                        }
                    }
                } catch (pass2Err) {
                    console.error('[DEBUG] Error executing Second-Pass Refinement, keeping Pass 1 image:', pass2Err);
                }
            }

            // --- PIXEL-LOCK BACKGROUND COMPOSITING & SERVER WATERMARK ---
            result.image = await pixelLockCompositeBackground({
                originalBase64: base64Image,
                generatedBase64: result.image,
            });
            const watermarkRes = await applyServerWatermark({
                imageBase64: result.image,
                logoUrl: profile?.watermark_logo_url || profile?.logo_url || null,
                logoSizePct: profile?.logo_size ?? 25,
            });
            result.image = watermarkRes.imageBase64;

            const activeModelId = result.modelUsed || fallbackModelId;
            const pass1CostUsd = calculateGenerationCostUsd({
                modelId: activeModelId,
                inputTokens: result.usage?.inputTokens,
                outputTokens: result.usage?.outputTokens,
                textOutputTokens: (result.usage as any)?.textOutputTokens,
                thinkingTokens: (result.usage as any)?.thinkingTokens,
                imageOutputTokens: (result.usage as any)?.imageOutputTokens,
                imageCount: 1,
                imageSize: result.imageSize || '2K',
            });
            const totalCostUsd = Number((pass1CostUsd + auxiliaryCostUsd).toFixed(6));

            // --- TRACKING START (Always use admin client when available so Generic Demo logs accurately for IP rate limiting) ---
            try {
                const trackingClient = adminClientInstance || dbClient;

                const promptTag = isAdminTest
                    ? `[ADMIN_TEST] ${promptConfig ? 'Dynamic Prompt' : 'Default Prompt'}${secondPassApplied ? ' + Second-Pass' : ''}`
                    : `${promptConfig ? 'Dynamic Prompt' : 'Default Prompt'}${secondPassApplied ? ' + Second-Pass' : ''}`;

                const baseTrackingRow = {
                    organization_id: profileIdToBill || null,
                    image_url: result.image.startsWith('data:') ? 'Base64 Image Data' : result.image,
                    prompt_used: promptTag,
                    style_id: style,
                    ip_address: clientIp,
                    user_agent: userAgent,
                    created_at: new Date().toISOString(),
                    model_id: activeModelId,
                    input_tokens: result.usage?.inputTokens || 0,
                    output_tokens: result.usage?.outputTokens || 0,
                };

                const insertRes = await trackingClient.from('generations').insert([{
                    ...baseTrackingRow,
                    cost_usd: totalCostUsd,
                }]);

                if ((insertRes as any)?.error?.message?.includes('cost_usd') || (insertRes as any)?.error?.code === 'PGRST204') {
                    await trackingClient.from('generations').insert([baseTrackingRow]);
                }
            } catch (err) {
                console.warn('[Tracking] Failed to log generation:', err);
            }
            // --- TRACKING END ---

            return {
                success: true,
                image: result.image,
                isAdminTest: !!isAdminTest,
                usage: result.usage
                    ? { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens }
                    : undefined,
                secondPassApplied,
                watermarkedOnServer: watermarkRes.watermarkedOnServer,
                costUsd: totalCostUsd,
            };
        } else {
            throw new Error(result.error || 'Unknown Nano Banana error');
        }

    } catch (error: any) {
        console.error('[ERROR] Generation Failed:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        if (isAdmin) {
            return { success: false, error: 'Generation Failed: ' + (error.message || 'Unknown error') };
        }
        return {
            success: false,
            error: 'Generation Failed: Service is temporarily busy or unable to process this photo. Please try again shortly.'
        };
    }
}
