'use server';

import fs from 'fs';
import path from 'path';
import { getActingUser } from '@/lib/auth-context';
import { checkIsAdmin } from '@/lib/auth-utils';
import { createAdminClient } from '@/lib/supabase/admin';
import {
    detectImageMetadata,
    INTERNAL_PROMPT_TOKEN,
    isSafeExternalUrl,
    isValidUuid,
    safeFetchImageBuffer,
} from '@/lib/validations';
import {
    extractFabricationSpecWithVision,
    generateCanonicalCutoutWithNanoBanana,
    generateDesignWithNanoBanana,
    validateStylePhotoWithVision,
} from '@/lib/vertex';
import {
    FabricationCategory,
    FabricationSpec,
    MAX_FREE_CALIBRATION_RENDERS,
    StyleSlotId,
    STYLE_PHOTO_SLOTS,
} from './types';

export interface BenchmarkPresetInfo {
    id: string;
    fileName: string;
    label: string;
    subtitle: string;
    url: string;
}

const BENCHMARK_PRESETS: readonly BenchmarkPresetInfo[] = [
    {
        id: 'exterior_deck',
        fileName: 'exterior-deck-steps.jpg',
        label: 'Exterior Wood Deck Steps',
        subtitle: 'Tests outdoor fascia/side-mount & demolition of old deck rail',
        url: '/presets/exterior-deck-steps.jpg',
    },
    {
        id: 'front_porch',
        fileName: 'front-porch-steps.jpg',
        label: 'Front Porch Brick Steps',
        subtitle: 'Tests top/core-mount masonry anchors & shorter landing return',
        url: '/presets/front-porch-steps.jpg',
    },
    {
        id: 'interior_hardwood',
        fileName: 'interior-hardwood-stairs.jpg',
        label: 'Interior Hardwood Stairs',
        subtitle: 'Tests indoor lighting, direct-tread spindles vs shoe rail',
        url: '/presets/interior-hardwood-stairs.jpg',
    },
    {
        id: 'modern_floating',
        fileName: 'modern-floating-stairs.jpg',
        label: 'Modern Floating Stairs',
        subtitle: 'Tests clean architectural rake pitch & tight joint tolerance',
        url: '/presets/modern-floating-stairs.jpg',
    },
];

export async function getBenchmarkPresets(): Promise<BenchmarkPresetInfo[]> {
    return [...BENCHMARK_PRESETS];
}

function isAllowedStyleImageUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    if (url.startsWith('/styles/') && !url.includes('..') && !url.includes('//')) return true;
    return isSafeExternalUrl(url);
}

async function loadImageUrlAsBase64(url: string): Promise<string | null> {
    if (!isAllowedStyleImageUrl(url)) return null;
    try {
        if (url.startsWith('/')) {
            const publicRoot = path.resolve(process.cwd(), 'public');
            const target = path.resolve(publicRoot, '.' + url);
            if (!target.startsWith(publicRoot + path.sep) || !fs.existsSync(target)) {
                return null;
            }
            return fs.readFileSync(target).toString('base64');
        }
        const buf = await safeFetchImageBuffer(url, { maxBytes: 12 * 1024 * 1024, timeoutMs: 10000 });
        if (!buf) return null;
        return buf.toString('base64');
    } catch (err) {
        console.warn('[STYLE WIZARD] Failed to read style image URL:', url, err);
        return null;
    }
}

function readSafeBenchmarkPresetBase64(presetIdOrFilename: string): { base64: string; preset: BenchmarkPresetInfo } | null {
    const preset = BENCHMARK_PRESETS.find(
        (p) => p.id === presetIdOrFilename || p.fileName === presetIdOrFilename
    );
    if (!preset) return null;

    const presetsRoot = path.resolve(process.cwd(), 'public', 'presets');
    const resolved = path.resolve(presetsRoot, preset.fileName);
    if (!resolved.startsWith(presetsRoot + path.sep) || !fs.existsSync(resolved)) {
        return null;
    }
    return {
        base64: fs.readFileSync(resolved).toString('base64'),
        preset,
    };
}

export async function validateWizardSlotPhoto(formData: FormData) {
    const { user } = await getActingUser();
    if (!user) return { success: false, error: 'Authentication required' };

    const slotId = formData.get('slot_id') as StyleSlotId;
    const category = ((formData.get('category') as FabricationCategory) || 'stair_railing');
    const imageUrl = formData.get('image_url') as string | null;
    const file = formData.get('file') as File | null;

    if (!slotId || !STYLE_PHOTO_SLOTS.some((s) => s.id === slotId)) {
        return { success: false, error: 'Invalid slot ID' };
    }

    let base64Image: string | null = null;
    if (file && file.size > 0) {
        if (file.size > 10 * 1024 * 1024) {
            return { success: false, error: 'Photo exceeds 10MB limit' };
        }
        const buf = Buffer.from(await file.arrayBuffer());
        const meta = detectImageMetadata(buf);
        if (!meta.valid || meta.mimeType === 'image/heic') {
            return { success: false, error: 'Unsupported photo format (use JPG, PNG, or WebP).' };
        }
        base64Image = buf.toString('base64');
    } else if (imageUrl) {
        base64Image = await loadImageUrlAsBase64(imageUrl);
    }

    if (!base64Image) {
        return { success: false, error: 'Could not read uploaded photo.' };
    }

    try {
        const validation = await validateStylePhotoWithVision({
            base64Image,
            slotId,
            category,
        });
        return { success: true, result: validation.result };
    } catch (err: any) {
        console.warn('[WIZARD VALIDATE] Vision check failed non-fatally:', err?.message);
        return {
            success: true,
            result: {
                valid: true,
                qualityScore: 80,
                slotMatch: true,
                feedback: 'Photo uploaded cleanly (automated validator temporarily unavailable).',
                suggestions: [],
            },
        };
    }
}

export async function extractWizardFabSpec(formData: FormData) {
    const { user } = await getActingUser();
    if (!user) return { success: false, error: 'Authentication required' };

    const labeledSlotsJson = formData.get('labeled_slots') as string;
    const category = ((formData.get('category') as FabricationCategory) || 'stair_railing');
    const name = (formData.get('name') as string) || '';
    const description = (formData.get('description') as string) || '';

    if (!labeledSlotsJson) {
        return { success: false, error: 'Missing labeled slot photos' };
    }

    try {
        const parsed = JSON.parse(labeledSlotsJson) as Partial<Record<StyleSlotId, string[]>>;
        const loaded: { slotId: StyleSlotId; base64Data: string }[] = [];

        for (const slotDef of STYLE_PHOTO_SLOTS) {
            const urls = parsed[slotDef.id];
            if (!Array.isArray(urls)) continue;
            for (const u of urls.slice(0, slotDef.maxCount)) {
                const b64 = await loadImageUrlAsBase64(u);
                if (b64) {
                    loaded.push({ slotId: slotDef.id, base64Data: b64 });
                }
            }
        }

        if (loaded.length === 0) {
            return { success: false, error: 'No accessible images found for analysis.' };
        }

        const extracted = await extractFabricationSpecWithVision({
            labeledImages: loaded,
            category,
            hints: { name, description },
        });

        return { success: true, spec: extracted.spec };
    } catch (err: any) {
        console.error('[WIZARD FAB SPEC] Extraction failed:', err);
        return { success: false, error: err?.message || 'Failed to extract fabrication spec.' };
    }
}

export async function generateWizardCanonicalCutout(formData: FormData) {
    const { user, tenantId, supabase: actingSupabase } = await getActingUser();
    if (!user || !tenantId) return { success: false, error: 'Authentication required' };

    const labeledSlotsJson = formData.get('labeled_slots') as string;
    const fabSpecJson = formData.get('fabrication_spec') as string;

    if (!labeledSlotsJson || !fabSpecJson) {
        return { success: false, error: 'Missing photos or fabrication spec for studio cutout.' };
    }

    try {
        const parsedSlots = JSON.parse(labeledSlotsJson) as Partial<Record<StyleSlotId, string[]>>;
        const fabSpec = JSON.parse(fabSpecJson) as FabricationSpec;

        const loaded: { slotId: StyleSlotId; base64Data: string }[] = [];
        for (const slotDef of STYLE_PHOTO_SLOTS) {
            const urls = parsedSlots[slotDef.id];
            if (!Array.isArray(urls)) continue;
            for (const u of urls.slice(0, slotDef.maxCount)) {
                const b64 = await loadImageUrlAsBase64(u);
                if (b64) {
                    loaded.push({ slotId: slotDef.id, base64Data: b64 });
                }
            }
        }

        if (loaded.length === 0) {
            return { success: false, error: 'No readable photos for canonical specimen generation.' };
        }

        const cutoutRes = await generateCanonicalCutoutWithNanoBanana({
            labeledImages: loaded,
            fabricationSpec: fabSpec,
        });

        if (!cutoutRes.success || !cutoutRes.image) {
            return { success: false, error: cutoutRes.error || 'Could not generate studio specimen cutout.' };
        }

        const rawBase64 = cutoutRes.image.includes(',')
            ? cutoutRes.image.slice(cutoutRes.image.indexOf(',') + 1)
            : cutoutRes.image;
        const imgBuffer = Buffer.from(rawBase64, 'base64');
        const storagePath = `${tenantId}/${Date.now()}_canonical_specimen.jpg`;

        const { error: upErr } = await actingSupabase.storage
            .from('portfolio')
            .upload(storagePath, imgBuffer, { contentType: 'image/jpeg', upsert: false });

        if (upErr) {
            return { success: false, error: 'Generated cutout could not be uploaded to storage.' };
        }

        const { data: pub } = actingSupabase.storage.from('portfolio').getPublicUrl(storagePath);
        return { success: true, canonicalUrl: pub.publicUrl };
    } catch (err: any) {
        console.error('[WIZARD CANONICAL] Failed:', err);
        return { success: false, error: err?.message || 'Failed to generate studio cutout.' };
    }
}

export async function runStyleCalibrationTest(formData: FormData) {
    const { user, tenantId, supabase: actingSupabase, isAdmin } = await getActingUser();
    if (!user || !tenantId) return { success: false, error: 'Authentication required' };

    const presetId = (formData.get('preset_id') as string) || 'interior_hardwood';
    const styleId = (formData.get('style_id') as string) || '';
    const draftUsed = Math.max(0, Number(formData.get('draft_free_used') || 0));
    const allowCreditSpend = formData.get('allow_credit_spend') === 'true';

    // Strict allowlist check: Calibration ONLY runs against the 4 built-in benchmark stairs,
    // never arbitrary homeowner photos, closing any free-render abuse vector.
    const benchmark = readSafeBenchmarkPresetBase64(presetId);
    if (!benchmark) {
        return { success: false, error: 'Invalid benchmark scene selected.' };
    }

    let styleMeta: Record<string, any> = {};
    let existingUsed = draftUsed;
    let dbStyleRow: any = null;

    if (styleId && isValidUuid(styleId)) {
        const { data: row } = await actingSupabase
            .from('portfolio')
            .select('*')
            .eq('id', styleId)
            .eq('tenant_id', tenantId)
            .single();
        if (!row) return { success: false, error: 'Style not found for your account.' };
        dbStyleRow = row;
        styleMeta = (row.style_metadata && typeof row.style_metadata === 'object') ? { ...row.style_metadata } : {};
        existingUsed = Math.max(0, Number(styleMeta.free_calibration_used || 0));
    }

    const requiresCredit = !isAdmin && existingUsed >= MAX_FREE_CALIBRATION_RENDERS;
    if (requiresCredit && !allowCreditSpend) {
        return {
            success: false,
            requiresCreditConsent: true,
            freeUsed: existingUsed,
            maxFree: MAX_FREE_CALIBRATION_RENDERS,
            error: `You have used all ${MAX_FREE_CALIBRATION_RENDERS} free calibration renders for this style.`,
        };
    }

    // Collect style photos from either saved style or wizard draft form data
    const labeledSlotsJson = formData.get('labeled_slots') as string | null;
    const fabSpecJson = formData.get('fabrication_spec') as string | null;
    const name = (formData.get('name') as string) || dbStyleRow?.name || 'Custom Style';
    const description = (formData.get('description') as string) || dbStyleRow?.description || '';
    const canonicalUrl = (formData.get('canonical_image_url') as string) || styleMeta.canonical_image_url;
    const useCanonicalCutout = formData.has('use_canonical_cutout')
        ? formData.get('use_canonical_cutout') === 'true'
        : styleMeta.use_canonical_cutout === true;

    let fabricationSpec: FabricationSpec | null = styleMeta.fabrication_spec || null;
    if (fabSpecJson) {
        try {
            fabricationSpec = JSON.parse(fabSpecJson);
        } catch {
            // keep existing
        }
    }

    let parsedSlots: Partial<Record<StyleSlotId, string[]>> = styleMeta.labeled_slots || {};
    if (labeledSlotsJson) {
        try {
            parsedSlots = JSON.parse(labeledSlotsJson);
        } catch {
            // keep existing
        }
    }

    const labeledSlotImages: { slotId: StyleSlotId; base64Data: string }[] = [];
    const base64StyleImages: string[] = [];

    if (Object.keys(parsedSlots).length > 0) {
        for (const slotDef of STYLE_PHOTO_SLOTS) {
            const urls = parsedSlots[slotDef.id];
            if (!Array.isArray(urls)) continue;
            for (let idx = 0; idx < urls.length; idx++) {
                const targetUrl =
                    slotDef.id === 'hero_run' && idx === 0 && useCanonicalCutout && canonicalUrl
                        ? canonicalUrl
                        : urls[idx];
                const b64 = await loadImageUrlAsBase64(targetUrl);
                if (b64) {
                    labeledSlotImages.push({ slotId: slotDef.id, base64Data: b64 });
                    base64StyleImages.push(b64);
                }
            }
        }
    } else if (dbStyleRow) {
        const legacyUrls = Array.from(
            new Set([dbStyleRow.image_url, ...(dbStyleRow.reference_images || [])].filter(Boolean))
        ) as string[];
        for (const u of legacyUrls) {
            const b64 = await loadImageUrlAsBase64(u);
            if (b64) base64StyleImages.push(b64);
        }
    }

    if (base64StyleImages.length === 0) {
        return { success: false, error: 'Upload at least 1 valid style photo before running calibration.' };
    }

    // If beyond 3 free renders and client consented to spend 1 credit, bill atomically now before rendering
    if (requiresCredit && allowCreditSpend) {
        const adminClient = createAdminClient() || actingSupabase;
        const { data: prof } = await adminClient
            .from('profiles')
            .select('tier_name, notification_state')
            .eq('id', tenantId)
            .single();
        const { PRICING_TIERS, DEFAULT_TIER } = await import('@/config/pricing');
        const tierKey = (prof?.tier_name as keyof typeof PRICING_TIERS) || DEFAULT_TIER;
        const tier = PRICING_TIERS[tierKey] || PRICING_TIERS[DEFAULT_TIER];

        if (typeof (adminClient as any).rpc === 'function') {
            const { data: rpcData, error: rpcErr } = await (adminClient as any).rpc('consume_generation_credit', {
                p_profile_id: tenantId,
                p_overage_rate: tier.overageRate,
                p_allowance: tier.allowance,
                p_notification_state: prof?.notification_state || {},
            });
            if (rpcErr || !rpcData?.allowed) {
                return { success: false, error: rpcData?.reason || 'Unable to process 1 credit for calibration.' };
            }
        }
    }

    const { getActiveSystemPrompt } = await import('@/app/admin/actions');
    const activePrompt = await getActiveSystemPrompt(INTERNAL_PROMPT_TOKEN);

    const hasBottomRail = fabricationSpec
        ? fabricationSpec.has_bottom_rail
        : dbStyleRow?.has_bottom_rail;
    const hasReducers = fabricationSpec
        ? fabricationSpec.post_to_rail_joint === 'stem_reducer'
            ? true
            : fabricationSpec.post_to_rail_joint === 'direct_flush_weld'
            ? false
            : dbStyleRow?.has_reducers
        : dbStyleRow?.has_reducers;
    const postMount =
        fabricationSpec?.post_mount_type === 'side' || fabricationSpec?.post_mount_type === 'top'
            ? fabricationSpec.post_mount_type
            : dbStyleRow?.post_mount || 'top';

    const genRes = await generateDesignWithNanoBanana(
        benchmark.base64,
        {
            base64StyleImages,
            labeledSlotImages: labeledSlotImages.length > 0 ? labeledSlotImages : undefined,
            technicalSpecs: {
                hasBottomRail,
                hasReducers,
                postMount,
                description: `${name} — ${description}`,
                fabricationSpec,
            },
        },
        activePrompt
            ? {
                  systemInstruction: activePrompt.system_instruction,
                  userTemplate: activePrompt.user_template,
                  negative_prompt: activePrompt.negative_prompt ?? undefined,
              }
            : undefined
    );

    if (!genRes.success || !genRes.image) {
        return { success: false, error: genRes.error || 'Calibration render failed.' };
    }

    const nextUsed = !requiresCredit ? existingUsed + 1 : existingUsed;
    if (dbStyleRow) {
        styleMeta.free_calibration_used = nextUsed;
        await actingSupabase
            .from('portfolio')
            .update({ style_metadata: styleMeta })
            .eq('id', dbStyleRow.id)
            .eq('tenant_id', tenantId);
    }

    return {
        success: true,
        image: genRes.image,
        benchmarkLabel: benchmark.preset.label,
        freeUsed: nextUsed,
        maxFree: MAX_FREE_CALIBRATION_RENDERS,
        chargedCredit: requiresCredit,
    };
}

export async function flagStyleForAdminReview(styleId: string, notes: string) {
    const { user, tenantId, supabase: actingSupabase } = await getActingUser();
    if (!user || !tenantId || !isValidUuid(styleId)) {
        return { success: false, error: 'Invalid request' };
    }

    const { data: row } = await actingSupabase
        .from('portfolio')
        .select('style_metadata')
        .eq('id', styleId)
        .eq('tenant_id', tenantId)
        .single();

    if (!row) return { success: false, error: 'Style not found' };

    const meta = (row.style_metadata && typeof row.style_metadata === 'object') ? { ...row.style_metadata } : {};
    meta.admin_review_requested = true;
    meta.admin_review_notes = notes.slice(0, 600);
    meta.admin_review_requested_at = new Date().toISOString();

    const { error } = await actingSupabase
        .from('portfolio')
        .update({ style_metadata: meta })
        .eq('id', styleId)
        .eq('tenant_id', tenantId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

/**
 * Non-destructive Admin Backfill:
 * Extracts structured FabricationSpec JSON for existing styles missing `fabrication_spec`,
 * without touching or replacing their existing `image_url`.
 */
export async function backfillLegacyStylesSpecs(limit: number = 25) {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return { success: false, error: 'Unauthorized: Admin privileges required.' };

    const adminSupabase = createAdminClient();
    if (!adminSupabase) return { success: false, error: 'Admin database client unavailable.' };

    const { data: styles, error } = await adminSupabase
        .from('portfolio')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

    if (error || !styles) {
        return { success: false, error: error?.message || 'Failed to load portfolio styles' };
    }

    const targets = styles
        .filter((s: any) => !s.style_metadata?.fabrication_spec)
        .slice(0, Math.max(1, Math.min(50, limit)));

    const updatedIds: string[] = [];
    const errors: string[] = [];

    for (const style of targets) {
        try {
            const urls = Array.from(
                new Set([style.image_url, ...(Array.isArray(style.reference_images) ? style.reference_images : [])].filter(Boolean))
            ) as string[];

            const labeled: { slotId: StyleSlotId; base64Data: string }[] = [];
            for (let i = 0; i < Math.min(urls.length, 4); i++) {
                const b64 = await loadImageUrlAsBase64(urls[i]);
                if (b64) {
                    labeled.push({
                        slotId: i === 0 ? 'hero_run' : i === 1 ? 'post_top_joint' : 'extra_context',
                        base64Data: b64,
                    });
                }
            }

            if (labeled.length === 0) continue;

            const { spec } = await extractFabricationSpecWithVision({
                labeledImages: labeled,
                category: style.style_metadata?.category || 'stair_railing',
                hints: {
                    name: style.name,
                    description: style.description,
                    postMount: style.post_mount || style.style_metadata?.post_mount,
                    hasReducers: style.has_reducers,
                    hasBottomRail: style.has_bottom_rail,
                },
            });

            const nextMeta: Record<string, any> = {
                ...(style.style_metadata && typeof style.style_metadata === 'object' ? style.style_metadata : {}),
                fabrication_spec: spec,
                use_canonical_cutout: false, // Never silently swap legacy hero photos
            };

            if (
                (nextMeta.post_mount === undefined || nextMeta.post_mount === null) &&
                !style.post_mount &&
                (spec.post_mount_type === 'side' || spec.post_mount_type === 'top')
            ) {
                nextMeta.post_mount = spec.post_mount_type;
            }

            const updatePayload: Record<string, any> = { style_metadata: nextMeta };
            if (style.has_bottom_rail === null || style.has_bottom_rail === undefined) {
                updatePayload.has_bottom_rail = spec.has_bottom_rail;
            }
            if (
                (style.has_reducers === null || style.has_reducers === undefined) &&
                (spec.post_to_rail_joint === 'stem_reducer' || spec.post_to_rail_joint === 'direct_flush_weld')
            ) {
                updatePayload.has_reducers = spec.post_to_rail_joint === 'stem_reducer';
            }

            const { error: upErr } = await adminSupabase
                .from('portfolio')
                .update(updatePayload)
                .eq('id', style.id);

            if (upErr) errors.push(`${style.name}: ${upErr.message}`);
            else updatedIds.push(style.id);
        } catch (err: any) {
            errors.push(`${style.name}: ${err?.message || 'Extraction error'}`);
        }
    }

    return {
        success: true,
        scannedCount: targets.length,
        updatedCount: updatedIds.length,
        updatedIds,
        errors,
    };
}
