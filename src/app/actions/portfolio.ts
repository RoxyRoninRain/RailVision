'use server';

import { createClient } from '@/lib/supabase/server';
import { detectImageMetadata, isSafeExternalUrl, isValidUuid } from '@/lib/validations';
import {
    FabricationCategory,
    FabricationSpec,
    MAX_WIZARD_TOTAL_PHOTOS,
    SECOND_PASS_ISSUES,
    StyleSlotId,
    STYLE_PHOTO_SLOTS,
} from './types';

function extractWizardMetadataFromFormData(
    formData: FormData,
    baseMeta: Record<string, any> = {}
): {
    error?: string;
    meta: Record<string, any>;
    syncedSpecs: {
        hasBottomRail?: boolean;
        hasReducers?: boolean | null;
        postMount?: 'top' | 'side';
    };
} {
    const meta: Record<string, any> = { ...baseMeta };
    const syncedSpecs: { hasBottomRail?: boolean; hasReducers?: boolean | null; postMount?: 'top' | 'side' } = {};
    const wizardMode = formData.get('wizard_mode') as string | null;

    if (wizardMode === 'v2') {
        meta.wizard_version = 2;
    }

    const categoryRaw = formData.get('wizard_category') as string | null;
    if (categoryRaw && ['stair_railing', 'wall_handrail', 'guardrail', 'hybrid'].includes(categoryRaw)) {
        meta.category = categoryRaw as FabricationCategory;
    }

    const labeledSlotsRaw = formData.get('labeled_slots') as string | null;
    if (labeledSlotsRaw) {
        try {
            const parsed = JSON.parse(labeledSlotsRaw);
            if (parsed && typeof parsed === 'object') {
                const cleanedSlots: Partial<Record<StyleSlotId, string[]>> = {};
                let totalPhotos = 0;

                for (const slotDef of STYLE_PHOTO_SLOTS) {
                    const list = parsed[slotDef.id];
                    if (Array.isArray(list)) {
                        const validUrls = list
                            .filter((u): u is string => isAllowedPortfolioUrl(u))
                            .slice(0, slotDef.maxCount);
                        if (validUrls.length > 0) {
                            cleanedSlots[slotDef.id] = validUrls;
                            totalPhotos += validUrls.length;
                        }
                    }
                }

                if (wizardMode === 'v2') {
                    for (const slotDef of STYLE_PHOTO_SLOTS) {
                        if (slotDef.required && (!cleanedSlots[slotDef.id] || cleanedSlots[slotDef.id]!.length === 0)) {
                            return {
                                error: `Wizard validation: Required slot #${slotDef.slotNumber} (${slotDef.title}) is missing a photo.`,
                                meta,
                                syncedSpecs,
                            };
                        }
                    }
                    if (totalPhotos > MAX_WIZARD_TOTAL_PHOTOS) {
                        return {
                            error: `Maximum ${MAX_WIZARD_TOTAL_PHOTOS} style photos allowed per style pack.`,
                            meta,
                            syncedSpecs,
                        };
                    }
                }

                meta.labeled_slots = cleanedSlots;

                // Auto-populate hidden Pass 2 close-up references directly from labeled wizard slots.
                const derivedDetails: Record<string, string> = {
                    ...(meta.second_pass?.detail_images || {}),
                };
                if (cleanedSlots.post_top_joint?.[0]) {
                    derivedDetails.reducers = cleanedSlots.post_top_joint[0];
                    derivedDetails.reducer_fittings = cleanedSlots.post_top_joint[0];
                }
                if (cleanedSlots.post_mount_base?.[0]) {
                    derivedDetails.side_mount = cleanedSlots.post_mount_base[0];
                    derivedDetails.top_mount = cleanedSlots.post_mount_base[0];
                }
                if (cleanedSlots.infill_bottom?.[0]) {
                    derivedDetails.shoe_rail = cleanedSlots.infill_bottom[0];
                    derivedDetails.direct_mount = cleanedSlots.infill_bottom[0];
                }

                if (Object.keys(derivedDetails).length > 0) {
                    meta.second_pass = {
                        enabled: meta.second_pass?.enabled ?? true,
                        targets: meta.second_pass?.targets ?? [],
                        custom_prompt: meta.second_pass?.custom_prompt,
                        detail_images: derivedDetails,
                    };
                }
            }
        } catch (err) {
            console.warn('Failed to parse labeled_slots:', err);
        }
    }

    const fabSpecRaw = formData.get('fabrication_spec') as string | null;
    if (fabSpecRaw) {
        try {
            const parsedSpec = JSON.parse(fabSpecRaw) as FabricationSpec;
            if (parsedSpec && typeof parsedSpec === 'object' && parsedSpec.material) {
                meta.fabrication_spec = parsedSpec;
                syncedSpecs.hasBottomRail = Boolean(parsedSpec.has_bottom_rail);
                if (parsedSpec.post_to_rail_joint === 'direct_flush_weld') {
                    syncedSpecs.hasReducers = false;
                } else if (parsedSpec.post_to_rail_joint === 'stem_reducer') {
                    syncedSpecs.hasReducers = true;
                }
                if (parsedSpec.post_mount_type === 'top' || parsedSpec.post_mount_type === 'side') {
                    syncedSpecs.postMount = parsedSpec.post_mount_type;
                    meta.post_mount = parsedSpec.post_mount_type;
                }
            }
        } catch (err) {
            console.warn('Failed to parse fabrication_spec:', err);
        }
    }

    const canonicalUrl = formData.get('canonical_image_url') as string | null;
    if (canonicalUrl && isAllowedPortfolioUrl(canonicalUrl)) {
        meta.canonical_image_url = canonicalUrl;
    }

    const useCanonicalRaw = formData.get('use_canonical_cutout');
    if (useCanonicalRaw !== null) {
        meta.use_canonical_cutout = useCanonicalRaw === 'true';
    }

    const calibrationApprovedRaw = formData.get('calibration_approved');
    if (calibrationApprovedRaw !== null) {
        meta.calibration_approved = calibrationApprovedRaw === 'true';
    }

    const freeCalibUsedRaw = formData.get('free_calibration_used');
    if (freeCalibUsedRaw !== null && !Number.isNaN(Number(freeCalibUsedRaw))) {
        meta.free_calibration_used = Math.max(0, Number(freeCalibUsedRaw));
    }

    return { meta, syncedSpecs };
}

const ALLOWED_PORTFOLIO_MIME_MAP: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

const SECOND_PASS_DETAIL_KEYS = SECOND_PASS_ISSUES.map(issue => issue.id);

function isAllowedPortfolioUrl(url: unknown): url is string {
    if (typeof url !== 'string' || !url.trim()) return false;
    if (url.startsWith('/styles/') && !url.includes('..') && !url.includes('//')) {
        return true;
    }
    return isSafeExternalUrl(url);
}

function getSafeImageExt(file: File): string | null {
    if (file.type && ALLOWED_PORTFOLIO_MIME_MAP[file.type]) {
        return ALLOWED_PORTFOLIO_MIME_MAP[file.type];
    }
    const rawExt = file.name?.split('.').pop()?.toLowerCase();
    if (rawExt && ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt)) {
        return rawExt === 'jpeg' ? 'jpg' : rawExt;
    }
    return null;
}

async function verifyPortfolioImageBuffer(file: File): Promise<{ buffer: Buffer; ext: string; contentType: string } | null> {
    if (!getSafeImageExt(file)) return null;
    const buffer = Buffer.from(await file.arrayBuffer());
    const meta = detectImageMetadata(buffer);
    if (!meta.valid || !meta.mimeType || meta.mimeType === 'image/heic') return null;
    const ext = ALLOWED_PORTFOLIO_MIME_MAP[meta.mimeType] || 'jpg';
    return { buffer, ext, contentType: meta.mimeType };
}

// --- Portfolio Actions ---

export async function createStyle(formData: FormData) {
    const { checkIsAdmin } = await import('@/lib/auth-utils');
    const { getActingUser } = await import('@/lib/auth-context');

    // Use the centralized acting user context
    // This handles:
    // 1. Regular User (acting as themselves)
    // 2. Impersonating Admin (acting as target tenant via cookie)
    // 3. Admin Override (legacy check for explicitly passed mismatching IDs can be handled below if strict mode is needed, but Impersonation is preferred)

    const actingContext = await getActingUser();
    const { user, isImpersonating, isAdmin } = actingContext;
    let targetTenantId = actingContext.tenantId;
    let actingSupabase = actingContext.supabase;

    if (!user) return { error: 'Not authenticated' };

    // --- LEGACY/EXPLICIT ADMIN OVERRIDE CHECK ---
    // If we are NOT impersonating via cookie, but an admin_tenant_id was passed in form,
    // we should respect that for continuity with existing Admin UIs (non-impersonation mode)
    const formAdminTenantId = formData.get('admin_tenant_id') as string;
    if (!isImpersonating && formAdminTenantId && formAdminTenantId !== user.id) {
        if (!isAdmin) return { error: 'Unauthorized Admin Access' };
        if (!isValidUuid(formAdminTenantId)) return { error: 'Invalid tenant ID' };

        targetTenantId = formAdminTenantId;
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const adminClient = createAdminClient();
        if (adminClient) actingSupabase = adminClient;
    }
    // ------------------------------------------

    // 1. Validate Files
    // Support legacy 'file', 'files', and admin 'reference_files' keys
    const files = (formData.getAll('files') as File[]).filter(f => f && f.size > 0);
    const singleFile = formData.get('file') as File;
    const referenceFiles = (formData.getAll('reference_files') as File[]).filter(f => f && f.size > 0);

    // Consolidate
    let allFiles: File[] = [];
    if (files && files.length > 0) allFiles = [...files];
    else if (singleFile && singleFile.size > 0) allFiles = [singleFile];

    if (referenceFiles.length > 0) {
        allFiles.push(...referenceFiles);
    }

    if (allFiles.length === 0 && !formData.get('image_url')) return { error: 'No files uploaded' };

    // Up to 8 photos (5 required detail slots + up to 3 optional macro/context photos)
    if (allFiles.length > MAX_WIZARD_TOTAL_PHOTOS) {
        return { error: `Too many files (Max ${MAX_WIZARD_TOTAL_PHOTOS})` };
    }

    const galleryUrls: string[] = [];
    const MAX_SIZE = 4.5 * 1024 * 1024;

    // 2. Upload Loop OR Client-Side URL extraction
    // CHECK FOR PRE-UPLOADED URLs (Scalability Fix)
    const directMainUrl = formData.get('image_url') as string;
    const directRefUrlsJson = formData.get('reference_urls') as string;

    if (directMainUrl) {
        if (!isAllowedPortfolioUrl(directMainUrl)) {
            return { error: 'Invalid or unsafe main image URL' };
        }
        galleryUrls.push(directMainUrl);
        if (directRefUrlsJson) {
            const refs = JSON.parse(directRefUrlsJson);
            if (Array.isArray(refs)) {
                for (const refUrl of refs) {
                    if (!isAllowedPortfolioUrl(refUrl)) {
                        return { error: 'Invalid or unsafe reference image URL' };
                    }
                    galleryUrls.push(refUrl);
                }
            }
        }
    } else {
        // Fallback: Server-Side Upload (Legacy/Small files)
        for (const file of allFiles) {
            if (file.size > MAX_SIZE) {
                return { error: `File ${file.name} too large. Max 4.5MB.` };
            }

            const verified = await verifyPortfolioImageBuffer(file);
            if (!verified) {
                return { error: `Unsupported or corrupted image file (${file.name}). Only JPG, PNG, and WEBP are allowed.` };
            }
            const fileName = `${targetTenantId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${verified.ext}`;

            const { error: uploadError } = await actingSupabase.storage
                .from('portfolio')
                .upload(fileName, verified.buffer, { contentType: verified.contentType, upsert: false });

            if (uploadError) {
                console.error('Upload Error:', uploadError);
                return { error: 'Upload failed for ' + file.name };
            }

            const { data: publicUrlData } = actingSupabase.storage.from('portfolio').getPublicUrl(fileName);
            galleryUrls.push(publicUrlData.publicUrl);
        }
    }

    const name = formData.get('name') as string;
    const desc = formData.get('description') as string;
    const priceMin = formData.get('price_min') ? parseFloat(formData.get('price_min') as string) : 0;
    const priceMax = formData.get('price_max') ? parseFloat(formData.get('price_max') as string) : 0;
    const hasBottomRail = formData.get('has_bottom_rail') === 'true';
    const hasReducersRaw = formData.get('has_reducers');
    const hasReducers = (hasReducersRaw !== null && hasReducersRaw !== undefined && hasReducersRaw !== '')
        ? hasReducersRaw === 'true'
        : null;
    const postMountRaw = formData.get('post_mount') as string;
    const postMount = (postMountRaw === 'side' || postMountRaw === 'top') ? postMountRaw : 'top';

    const enableSecondPass = formData.get('enable_second_pass') === 'true';
    const secondPassTargetsRaw = formData.get('second_pass_targets') as string;
    let secondPassTargets: string[] = [];
    if (secondPassTargetsRaw) {
        try {
            secondPassTargets = JSON.parse(secondPassTargetsRaw);
        } catch {
            secondPassTargets = secondPassTargetsRaw.split(',').map(s => s.trim()).filter(Boolean);
        }
    }
    const secondPassCustomPrompt = (formData.get('second_pass_custom_prompt') as string) || '';

    // Parse second-pass detail images
    const secondPassDetailImagesRaw = formData.get('second_pass_detail_images') as string;
    const detailImages: Record<string, string> = {};
    if (secondPassDetailImagesRaw) {
        try {
            const parsedDetails = JSON.parse(secondPassDetailImagesRaw);
            if (parsedDetails && typeof parsedDetails === 'object') {
                for (const [k, v] of Object.entries(parsedDetails)) {
                    if (isAllowedPortfolioUrl(v)) {
                        detailImages[k] = v;
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to parse second_pass_detail_images in createStyle:', e);
        }
    }

    // Also handle files uploaded on server side (e.g. Admin mode)
    for (const key of SECOND_PASS_DETAIL_KEYS) {
        const detailFile = formData.get(`second_pass_detail_file_${key}`) as File;
        if (detailFile && detailFile.size > 0 && detailFile.size <= 5 * 1024 * 1024) {
            const verified = await verifyPortfolioImageBuffer(detailFile);
            if (!verified) continue;
            const fileName = `${targetTenantId}/${Date.now()}_detail_${key}_${Math.random().toString(36).substring(7)}.${verified.ext}`;
            const { error: upErr } = await actingSupabase.storage
                .from('portfolio')
                .upload(fileName, verified.buffer, { contentType: verified.contentType, upsert: false });
            if (!upErr) {
                const { data: pubData } = actingSupabase.storage.from('portfolio').getPublicUrl(fileName);
                detailImages[key] = pubData.publicUrl;
            }
        }
    }

    const styleMetadata: any = {};
    if (enableSecondPass || secondPassTargets.length > 0 || secondPassCustomPrompt || Object.keys(detailImages).length > 0) {
        styleMetadata.second_pass = {
            enabled: enableSecondPass,
            targets: secondPassTargets,
            custom_prompt: secondPassCustomPrompt.trim() || undefined,
            detail_images: Object.keys(detailImages).length > 0 ? detailImages : undefined
        };
    }
    if (postMount) {
        styleMetadata.post_mount = postMount;
    }

    const wizardExtraction = extractWizardMetadataFromFormData(formData, styleMetadata);
    if (wizardExtraction.error) {
        return { error: wizardExtraction.error };
    }
    const mergedStyleMetadata = wizardExtraction.meta;
    const finalHasBottomRail = wizardExtraction.syncedSpecs.hasBottomRail ?? hasBottomRail;
    const finalHasReducers = wizardExtraction.syncedSpecs.hasReducers !== undefined
        ? wizardExtraction.syncedSpecs.hasReducers
        : hasReducers;
    const finalPostMount = wizardExtraction.syncedSpecs.postMount ?? postMount;

    // 3. Insert into DB
    // First image is "image_url" (Thumbnail/Main), Rest are "reference_images" (Hidden Context)
    const mainImage = galleryUrls[0];
    const hiddenRefs = galleryUrls.slice(1);

    // Get current max display_order
    const { data: maxOrderData } = await actingSupabase
        .from('portfolio')
        .select('display_order')
        .eq('tenant_id', targetTenantId)
        .order('display_order', { ascending: false })
        .limit(1)
        .single();

    const nextOrder = (maxOrderData?.display_order ?? 0) + 1;

    const insertPayload: any = {
        name,
        description: desc,
        image_url: mainImage,
        reference_images: hiddenRefs,
        tenant_id: targetTenantId,
        is_active: true,
        price_per_ft_min: priceMin,
        price_per_ft_max: priceMax,
        has_bottom_rail: finalHasBottomRail,
        has_reducers: finalHasReducers,
        post_mount: finalPostMount,
        display_order: nextOrder,
        style_metadata: Object.keys(mergedStyleMetadata).length > 0 ? mergedStyleMetadata : null
    };

    let { data, error: dbError } = await actingSupabase
        .from('portfolio')
        .insert({ ...insertPayload })
        .select()
        .single();

    // Graceful fallback if the post_mount column hasn't been added to Postgres yet or schema cache is stale
    if (dbError && (dbError.message?.includes('post_mount') || dbError.code === 'PGRST204')) {
        console.warn('post_mount column not in schema cache; falling back to style_metadata:', dbError.message);
        delete insertPayload.post_mount;
        styleMetadata.post_mount = postMount;
        insertPayload.style_metadata = styleMetadata;

        const retry = await actingSupabase
            .from('portfolio')
            .insert({ ...insertPayload })
            .select()
            .single();
        dbError = retry.error;
        data = retry.data;
    }

    if (dbError) {
        console.error('DB Insert Error:', dbError);
        return { error: 'Database error: ' + dbError.message };
    }

    return { success: true };
}

export async function updateStyle(formData: FormData) {
    const { checkIsAdmin } = await import('@/lib/auth-utils');
    const { getActingUser } = await import('@/lib/auth-context');

    const styleId = formData.get('id') as string;
    if (!styleId) return { error: 'Style ID required' };

    const actingContext = await getActingUser();
    const { user, isImpersonating, isAdmin } = actingContext;
    let targetTenantId = actingContext.tenantId;
    let actingSupabase = actingContext.supabase;

    if (!user) return { error: 'Not authenticated' };

    // --- LEGACY/EXPLICIT ADMIN OVERRIDE CHECK ---
    const formAdminTenantId = formData.get('admin_tenant_id') as string;
    if (!isImpersonating && formAdminTenantId && formAdminTenantId !== user.id) {
        if (!isAdmin) return { error: 'Unauthorized Admin Access' };
        if (!isValidUuid(formAdminTenantId)) return { error: 'Invalid tenant ID' };

        targetTenantId = formAdminTenantId;
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const adminClient = createAdminClient();
        if (adminClient) actingSupabase = adminClient;
    }
    // ------------------------------------------

    // 1. Handle Main Image Replace (Optional)

    // Check for direct URL first
    const directMainUrl = formData.get('image_url') as string;

    const file = formData.get('file') as File;
    let mainImage = null;

    if (directMainUrl) {
        if (!isAllowedPortfolioUrl(directMainUrl)) {
            return { error: 'Invalid or unsafe main image URL' };
        }
        mainImage = directMainUrl;
    } else if (file && file.size > 0) {
        if (file.size > 5 * 1024 * 1024) {
            return { error: `File ${file.name} too large. Max 5MB.` };
        }

        const verified = await verifyPortfolioImageBuffer(file);
        if (!verified) {
            return { error: `Unsupported or corrupted image file (${file.name}). Only JPG, PNG, and WEBP are allowed.` };
        }
        const fileName = `${targetTenantId}/${Date.now()}_update_main_${Math.random().toString(36).substring(7)}.${verified.ext}`;

        const { error: uploadError } = await actingSupabase.storage
            .from('portfolio')
            .upload(fileName, verified.buffer, { contentType: verified.contentType, upsert: false });

        if (uploadError) {
            console.error('Update Main Upload Error:', uploadError);
            return { error: 'Main image upload failed' };
        }

        const { data: publicUrlData } = actingSupabase.storage.from('portfolio').getPublicUrl(fileName);
        mainImage = publicUrlData.publicUrl;
    }

    // 2. Handle Reference Images (New Uploads)
    // Support multiple 'reference_files'
    const referenceFiles = formData.getAll('reference_files') as File[];
    const newRefUrls: string[] = [];

    // Check for direct URLs for new refs
    const directNewRefUrlsJson = formData.get('new_reference_urls') as string;

    if (directNewRefUrlsJson) {
        const refs = JSON.parse(directNewRefUrlsJson);
        if (Array.isArray(refs)) {
            for (const refUrl of refs) {
                if (!isAllowedPortfolioUrl(refUrl)) {
                    return { error: 'Invalid or unsafe reference image URL' };
                }
                newRefUrls.push(refUrl);
            }
        }
    }

    // Legacy fallback
    if (referenceFiles && referenceFiles.length > 0) {
        for (const refFile of referenceFiles) {
            if (!refFile || refFile.size === 0 || refFile.size > 5 * 1024 * 1024) continue; // Skip empty or large files
            const verified = await verifyPortfolioImageBuffer(refFile);
            if (!verified) continue;
            const refName = `${targetTenantId}/${Date.now()}_ref_${Math.random().toString(36).substring(7)}.${verified.ext}`;

            const { error: refErr } = await actingSupabase.storage
                .from('portfolio')
                .upload(refName, verified.buffer, { contentType: verified.contentType, upsert: false });

            if (!refErr) {
                const { data: pubData } = actingSupabase.storage.from('portfolio').getPublicUrl(refName);
                newRefUrls.push(pubData.publicUrl);
            }
        }
    }

    // 3. Handle Existing Reference Images (Preservation)
    let finalRefList: string[] | undefined = undefined;
    const keptRefsJson = formData.get('kept_reference_urls') as string;

    if (keptRefsJson || newRefUrls.length > 0) {
        const rawKeptRefs = keptRefsJson ? JSON.parse(keptRefsJson) : [];
        const keptRefs = Array.isArray(rawKeptRefs) ? rawKeptRefs.filter(isAllowedPortfolioUrl) : [];

        if (keptRefsJson !== null) {
            // Explicit list provided
            finalRefList = [...keptRefs, ...newRefUrls];
        } else {
            // Just append mode (fetch existing first)
            const { data: currentStyle } = await actingSupabase.from('portfolio').select('reference_images').eq('id', styleId).single();
            const currentRefs = currentStyle?.reference_images || [];
            finalRefList = [...currentRefs, ...newRefUrls];
        }
    }

    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const priceMin = formData.get('price_min') ? parseFloat(formData.get('price_min') as string) : undefined;
    const priceMax = formData.get('price_max') ? parseFloat(formData.get('price_max') as string) : undefined;
    const hasBottomRailRaw = formData.get('has_bottom_rail');
    const hasBottomRail = hasBottomRailRaw !== null ? hasBottomRailRaw === 'true' : undefined;
    const hasReducersRaw = formData.get('has_reducers');
    const hasReducers = hasReducersRaw !== null && hasReducersRaw !== '' ? hasReducersRaw === 'true' : undefined;
    const postMountRaw = formData.get('post_mount') as string;
    const postMount = (postMountRaw === 'side' || postMountRaw === 'top') ? postMountRaw : undefined;

    // 4. Prepare Update Object
    const updates: any = {};
    if (name) updates.name = name;
    if (description !== null) updates.description = description;
    if (priceMin !== undefined) updates.price_per_ft_min = priceMin;
    if (priceMax !== undefined) updates.price_per_ft_max = priceMax;
    if (hasBottomRail !== undefined) updates.has_bottom_rail = hasBottomRail;
    if (hasReducers !== undefined) updates.has_reducers = hasReducers;
    if (postMount !== undefined) updates.post_mount = postMount;
    if (mainImage) updates.image_url = mainImage;
    if (finalRefList !== undefined) updates.reference_images = finalRefList;

    // Handle second-pass refinement metadata and post_mount metadata
    const enableSecondPassRaw = formData.get('enable_second_pass');
    const secondPassTargetsRaw = formData.get('second_pass_targets') as string;
    const secondPassCustomPromptRaw = formData.get('second_pass_custom_prompt') as string;
    const secondPassDetailImagesRaw = formData.get('second_pass_detail_images') as string;
    let updatedDetailImages: Record<string, string> | null = null;
    if (secondPassDetailImagesRaw) {
        try {
            const parsedDetails = JSON.parse(secondPassDetailImagesRaw);
            if (parsedDetails && typeof parsedDetails === 'object') {
                updatedDetailImages = {};
                for (const [k, v] of Object.entries(parsedDetails)) {
                    if (isAllowedPortfolioUrl(v)) {
                        updatedDetailImages[k] = v;
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to parse second_pass_detail_images in updateStyle:', e);
        }
    }

    const hasWizardMetadataUpdate =
        formData.get('wizard_mode') === 'v2' ||
        formData.get('labeled_slots') !== null ||
        formData.get('fabrication_spec') !== null ||
        formData.get('canonical_image_url') !== null ||
        formData.get('use_canonical_cutout') !== null ||
        formData.get('calibration_approved') !== null;

    if (
        enableSecondPassRaw !== null ||
        secondPassTargetsRaw !== null ||
        secondPassCustomPromptRaw !== null ||
        postMount !== undefined ||
        updatedDetailImages !== null ||
        hasWizardMetadataUpdate
    ) {
        const { data: currentStyle } = await actingSupabase
            .from('portfolio')
            .select('style_metadata')
            .eq('id', styleId)
            .single();

        let currentMeta = (currentStyle?.style_metadata && typeof currentStyle.style_metadata === 'object')
            ? { ...currentStyle.style_metadata }
            : {};

        if (postMount !== undefined) {
            currentMeta.post_mount = postMount;
        }

        // Check for direct server file uploads in updateStyle (e.g. Admin mode)
        for (const key of SECOND_PASS_DETAIL_KEYS) {
            const detailFile = formData.get(`second_pass_detail_file_${key}`) as File;
            if (detailFile && detailFile.size > 0 && detailFile.size <= 5 * 1024 * 1024) {
                const verified = await verifyPortfolioImageBuffer(detailFile);
                if (!verified) continue;
                const fileName = `${targetTenantId}/${Date.now()}_detail_${key}_${Math.random().toString(36).substring(7)}.${verified.ext}`;
                const { error: upErr } = await actingSupabase.storage
                    .from('portfolio')
                    .upload(fileName, verified.buffer, { contentType: verified.contentType, upsert: false });
                if (!upErr) {
                    const { data: pubData } = actingSupabase.storage.from('portfolio').getPublicUrl(fileName);
                    if (!updatedDetailImages) {
                        updatedDetailImages = { ...(currentMeta.second_pass?.detail_images || {}) };
                    }
                    if (updatedDetailImages) {
                        updatedDetailImages[key] = pubData.publicUrl;
                    }
                }
            }
        }

        if (enableSecondPassRaw !== null || secondPassTargetsRaw !== null || secondPassCustomPromptRaw !== null || updatedDetailImages !== null) {
            let targets = currentMeta.second_pass?.targets || [];
            if (secondPassTargetsRaw !== null && secondPassTargetsRaw !== undefined) {
                try {
                    targets = JSON.parse(secondPassTargetsRaw);
                } catch {
                    targets = secondPassTargetsRaw.split(',').map((s: string) => s.trim()).filter(Boolean);
                }
            }

            const enabled = enableSecondPassRaw !== null
                ? enableSecondPassRaw === 'true'
                : !!currentMeta.second_pass?.enabled;

            const customPrompt = secondPassCustomPromptRaw !== null
                ? (secondPassCustomPromptRaw as string)
                : currentMeta.second_pass?.custom_prompt;

            const detailImages = updatedDetailImages !== null
                ? (Object.keys(updatedDetailImages).length > 0 ? updatedDetailImages : undefined)
                : currentMeta.second_pass?.detail_images;

            currentMeta.second_pass = {
                enabled,
                targets,
                custom_prompt: customPrompt ? customPrompt.trim() : undefined,
                detail_images: detailImages
            };
        }

        if (hasWizardMetadataUpdate) {
            const wizardUpdate = extractWizardMetadataFromFormData(formData, currentMeta);
            if (wizardUpdate.error) {
                return { error: wizardUpdate.error };
            }
            currentMeta = wizardUpdate.meta;
            if (wizardUpdate.syncedSpecs.hasBottomRail !== undefined && updates.has_bottom_rail === undefined) {
                updates.has_bottom_rail = wizardUpdate.syncedSpecs.hasBottomRail;
            }
            if (wizardUpdate.syncedSpecs.hasReducers !== undefined && updates.has_reducers === undefined) {
                updates.has_reducers = wizardUpdate.syncedSpecs.hasReducers;
            }
            if (wizardUpdate.syncedSpecs.postMount && updates.post_mount === undefined) {
                updates.post_mount = wizardUpdate.syncedSpecs.postMount;
            }
        }

        updates.style_metadata = currentMeta;
    }

    let { error: dbError } = await actingSupabase
        .from('portfolio')
        .update({ ...updates })
        .eq('id', styleId)
        .eq('tenant_id', targetTenantId);

    // Graceful fallback if the post_mount column hasn't been added to Postgres yet or schema cache is stale
    if (dbError && (dbError.message?.includes('post_mount') || dbError.code === 'PGRST204')) {
        console.warn('post_mount column not in schema cache during update; falling back to style_metadata:', dbError.message);
        delete updates.post_mount;
        const retry = await actingSupabase
            .from('portfolio')
            .update({ ...updates })
            .eq('id', styleId)
            .eq('tenant_id', targetTenantId);
        dbError = retry.error;
    }

    if (dbError) {
        console.error('DB Update Error:', dbError);
        return { error: 'Database error: ' + dbError.message };
    }

    return { success: true };
}

export async function updateStyleStatus(id: string, isActive: boolean) {
    const { getActingUser } = await import('@/lib/auth-context');
    const { user, tenantId, supabase: actingSupabase } = await getActingUser();
    if (!user) return { error: 'Unauthorized' };

    const { error } = await actingSupabase
        .from('portfolio')
        .update({ is_active: isActive })
        .eq('id', id)
        .eq('tenant_id', tenantId);

    if (error) return { error: error.message };
    return { success: true };
}

export async function seedDefaultStyles() {
    const { getActingUser } = await import('@/lib/auth-context');
    const { user, tenantId, supabase: actingSupabase } = await getActingUser();
    if (!user) return { error: 'Unauthorized' };

    // Check if user already has styles
    const { count } = await actingSupabase
        .from('portfolio')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

    if (count && count > 0) return { success: true, message: 'Styles already exist' };

    // Default Styles
    const defaults = [
        { name: 'Industrial', description: 'Raw steel and exposed elements', image_url: '/styles/industrial.png' },
        { name: 'Modern', description: 'Clean lines and glass', image_url: '/styles/modern.png' },
        { name: 'Rustic Farmhouse', description: 'Warm wood tones mixed with metal', image_url: '/styles/rustic.png' },
        { name: 'Art Deco', description: 'Bold geometric patterns and luxury', image_url: 'https://images.unsplash.com/photo-1534349762913-961f712ba68e?auto=format&fit=crop&w=800&q=80' },
    ];

    const { error } = await actingSupabase
        .from('portfolio')
        .insert(defaults.map(d => ({
            ...d,
            tenant_id: tenantId,
            is_active: true
        })));

    if (error) return { error: error.message };
    return { success: true, seeded: true };
}

export async function deleteStyle(styleId: string) {
    const { getActingUser } = await import('@/lib/auth-context');
    const { user, tenantId, supabase: actingSupabase, isAdmin, isImpersonating } = await getActingUser();

    if (!user) return { error: 'Not authenticated' };

    // Check if the acting tenant owns it
    // If impersonating, 'tenantId' is the target tenant, so this check passes if they own it.
    const { count } = await actingSupabase.from('portfolio').select('id', { count: 'exact', head: true }).eq('id', styleId).eq('tenant_id', tenantId);

    if (count === 0) {
        // Not owner (or not acting as owner)
        // If we are a real Admin NOT successfully impersonating the owner, we might check if we can Force Delete
        // But for now, if 'count' is 0 with an Admin Client (which actingSupabase is if impersonating), 
        // it really means the style doesn't belong to the targeted tenant.

        // However, fallback: If I am Admin and NOT impersonating, maybe I want to delete it by ID regardless of owner?
        if (isAdmin && !isImpersonating) {
            const { createAdminClient } = await import('@/lib/supabase/admin');
            const adminSupabase = createAdminClient();
            if (adminSupabase) {
                // Direct delete by ID (God Mode)
                const { error: adminDelError } = await adminSupabase.from('portfolio').delete().eq('id', styleId);
                if (adminDelError) return { error: adminDelError.message };
                return { success: true };
            }
        }

        return { error: 'Unauthorized or Style not found' };
    }


    const { error } = await actingSupabase
        .from('portfolio')
        .delete()
        .eq('id', styleId);

    if (error) return { error: error.message };
    return { success: true };
}

export async function getTenantStyles(tenantId?: string) {
    const { getActingUser } = await import('@/lib/auth-context');
    const { user, tenantId: actingTenantId, supabase: actingSupabase, isAdmin, isImpersonating } = await getActingUser();

    const targetTenantId = tenantId || actingTenantId; // Use argument if present, else acting ID

    // If argument provided AND it's different from who we are acting as
    if (tenantId && tenantId !== actingTenantId) {
        // If we are Impersonating Tenant A, and we request Tenant B... we probably shouldn't allow that lightly?
        // Or if we are Admin (not impersonating), and we request Tenant B -> Allow it (Explicit Admin View)

        if (isAdmin) {
            const { createAdminClient } = await import('@/lib/supabase/admin');
            const adminClient = createAdminClient();
            // We use the admin client to fetch the requested tenant's data
            // We do NOT update actingSupabase here because 'actingSupabase' is bound to the 'actingTenantId' context.
            // Instead we'll just redefine the query to use the admin client.
            if (adminClient) {
                const { data, error } = await adminClient
                    .from('portfolio')
                    .select('*')
                    .eq('tenant_id', targetTenantId)
                    .order('display_order', { ascending: true })
                    .order('created_at', { ascending: false });

                if (error) return { data: [], error: error.message };
                return { data, error: null };
            }
        }
        // If not admin, we can't see other tenant's data
        return { data: [], error: 'Unauthorized' };
    }

    if (!targetTenantId) return { data: [], error: 'No tenant ID found' };

    // Standard Path (Acting as target, or Target is Self)
    // actingSupabase is already configured correct via getActingUser (Admin Client if impersonating, Anon if not)

    const { data, error } = await actingSupabase
        .from('portfolio')
        .select('*')
        .eq('tenant_id', targetTenantId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Get Tenant Styles Error:', error);
        return { data: [], error: error.message };
    }

    return { data, error: null };
}

export async function getPublicStyles(tenantId: string) {
    if (!isValidUuid(tenantId)) return [];

    // Use Admin Client to bypass RLS for public portfolio access
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();

    // Fallback if Admin Client fails (simulated env or missing key)
    if (!supabase) {
        console.warn('getPublicStyles: No Admin Client, falling back to anon client (may fail RLS)');
        const standardClient = await createClient();
        const { data, error } = await standardClient
            .from('portfolio')
            .select('id, name, description, image_url, price_per_ft_min, price_per_ft_max') // Exclude reference_images
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Get Public Styles (Anon) Error:', error);
            return [];
        }
        return data;
    }

    let adminError = null;

    if (supabase) {
        const result = await supabase
            .from('portfolio')
            .select('id, name, description, image_url, price_per_ft_min, price_per_ft_max')
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (!result.error) {
            return result.data;
        }
        adminError = result.error;
        console.warn('getPublicStyles: Admin Client failed (likely invalid key), preventing crash by falling back to Anon.', adminError);
    }

    // Fallback to Anon Client (if Admin missing OR Admin Query Failed)
    console.warn('getPublicStyles: Using Anon Client Fallback');
    const standardClient = await createClient();
    const { data: anonData, error: anonError } = await standardClient
        .from('portfolio')
        .select('id, name, description, image_url, price_per_ft_min, price_per_ft_max')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

    if (anonError) {
        console.error('Get Public Styles (Anon) Error:', anonError);
        // If both failed, return empty but log
        return [];
    }
    return anonData;
}

export async function getStyles(tenantId?: string) {
    if (tenantId && isValidUuid(tenantId)) {
        const supabase = await createClient();
        const { data } = await supabase
            .from('portfolio')
            .select('id, name, description, image_url, price_per_ft_min, price_per_ft_max') // Exclude reference_images
            .eq('tenant_id', tenantId)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (data && data.length > 0) {
            // Map to ensure it matches the format
            return data as any[];
        }
    }


    // Default System Styles available to everyone
    return [
        { id: '1', name: 'Industrial', description: 'Raw steel and exposed elements', image_url: '/styles/industrial.png' },
        { id: '2', name: 'Modern', description: 'Clean lines and glass', image_url: '/styles/modern.png' },
        { id: '3', name: 'Rustic', description: 'Wood and iron', image_url: '/styles/rustic.png' },
        // Fallback for Art Deco since 429 error prevented generation
        { id: '4', name: 'Art Deco', description: 'Geometric patterns and brass', image_url: 'https://images.unsplash.com/photo-1551524559-867bc05417ab?w=400&q=80' }
    ];
}

export async function reorderStyles(items: { id: string; order: number }[]) {
    const { getActingUser } = await import('@/lib/auth-context');
    const { user, tenantId, supabase: actingSupabase } = await getActingUser();

    if (!user) return { error: 'Not authenticated' };

    try {
        const updates = items.map(item =>
            actingSupabase
                .from('portfolio')
                .update({ display_order: item.order })
                .eq('id', item.id)
                .eq('tenant_id', tenantId)
        );

        await Promise.all(updates);
        return { success: true };
    } catch (err: any) {
        console.error('Reorder Error:', err);
        return { error: 'Failed to reorder styles' };
    }
}
