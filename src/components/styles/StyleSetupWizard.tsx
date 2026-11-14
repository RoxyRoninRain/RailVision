'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    Check,
    CheckCircle2,
    HelpCircle,
    Image as ImageIcon,
    Loader2,
    ShieldCheck,
    Sparkles,
    Upload,
    Wand2,
    Wrench,
    X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { compressImage } from '@/utils/imageUtils';
import {
    convertHeicToJpg,
    createStyle,
    extractWizardFabSpec,
    flagStyleForAdminReview,
    generateWizardCanonicalCutout,
    getBenchmarkPresets,
    PortfolioItem,
    runStyleCalibrationTest,
    updateStyle,
    validateWizardSlotPhoto,
} from '@/app/actions';
import {
    BenchmarkPresetInfo,
} from '@/app/actions/style-wizard';
import {
    FabricationCategory,
    FabricationInfillType,
    FabricationJointType,
    FabricationPostMount,
    FabricationSpec,
    MAX_FREE_CALIBRATION_RENDERS,
    MAX_WIZARD_TOTAL_PHOTOS,
    MIN_WIZARD_REQUIRED_SLOTS,
    STYLE_PHOTO_SLOTS,
    StyleSlotDefinition,
    StyleSlotId,
} from '@/app/actions/types';

interface SlotValidationState {
    checking?: boolean;
    valid?: boolean;
    qualityScore?: number;
    feedback?: string;
    suggestions?: string[];
}

interface StyleSetupWizardProps {
    onClose: () => void;
    onSuccess: () => void;
    existingStyle?: PortfolioItem | null;
    isAdmin?: boolean;
    adminTenantId?: string;
}

const DEFAULT_FAB_SPEC = (category: FabricationCategory): FabricationSpec => ({
    category,
    material: 'Wrought Iron / Steel',
    finish: 'Matte Black Powder Coat',
    top_rail_profile: '1.5" x 0.75" molded cap rail',
    post_profile: category === 'wall_handrail' ? 'N/A (Wall Mounted)' : '1.5" square tube',
    post_mount_type: category === 'wall_handrail' ? 'wall' : 'top',
    bolt_pattern: category === 'wall_handrail' ? '2-screw round escutcheon bracket' : '4-bolt surface base flange',
    post_to_rail_joint: category === 'wall_handrail' ? 'wall_bracket' : 'direct_flush_weld',
    infill_type: category === 'wall_handrail' ? 'none_wall_only' : 'vertical_pickets',
    infill_profile_and_spacing: category === 'wall_handrail' ? 'Wall grab rail only' : '1/2" square pickets @ 3.75" OC',
    has_bottom_rail: false,
    bottom_termination: category === 'wall_handrail' ? 'N/A' : 'Pickets anchored directly into treads',
    handrail_return: '90° mitered wall return',
    distinctive_features: [],
    conflicts_detected: [],
});

/**
 * Architectural SVG coaching illustration tailored per photo slot so clients
 * immediately understand exact camera distance & framing before snapping a photo.
 */
function SlotCoachingSvg({ slotId, isWall }: { slotId: StyleSlotId; isWall: boolean }) {
    return (
        <svg viewBox="0 0 280 150" className="w-full h-36 bg-zinc-950 rounded-lg border border-white/10">
            <rect width="280" height="150" fill="#09090b" />
            {slotId === 'hero_run' && (
                <g stroke="#e4e4e7" strokeWidth="2.5" fill="none">
                    <path d="M25 125 L65 125 L65 100 L105 100 L105 75 L145 75 L145 50 L235 50" stroke="#3f3f46" strokeWidth="2" />
                    <line x1="40" y1="125" x2="40" y2="75" stroke="#f59e0b" strokeWidth="4" />
                    <line x1="145" y1="50" x2="145" y2="12" stroke="#f59e0b" strokeWidth="4" />
                    <line x1="40" y1="75" x2="145" y2="12" stroke="#f59e0b" strokeWidth="4.5" />
                    <line x1="145" y1="12" x2="225" y2="12" stroke="#f59e0b" strokeWidth="4.5" />
                    {[62, 84, 106, 128].map((x, idx) => (
                        <line key={x} x1={x} y1={115 - idx * 14} x2={x} y2={61 - idx * 14} stroke="#a1a1aa" strokeWidth="1.5" />
                    ))}
                    <rect x="20" y="6" width="240" height="132" rx="6" stroke="#22c55e" strokeDasharray="5 4" strokeWidth="1.5" />
                    <text x="140" y="144" textAnchor="middle" fill="#a1a1aa" fontSize="9" fontFamily="monospace">WIDE 3/4 VIEW • FULL SLOPE + POSTS (6–10 FT)</text>
                </g>
            )}
            {slotId === 'post_top_joint' && (
                <g>
                    <line x1="40" y1="75" x2="240" y2="30" stroke="#e4e4e7" strokeWidth="16" strokeLinecap="round" />
                    {isWall ? (
                        <path d="M140 53 L140 85 L110 85" stroke="#f59e0b" strokeWidth="9" fill="none" strokeLinejoin="round" />
                    ) : (
                        <line x1="140" y1="53" x2="140" y2="132" stroke="#f59e0b" strokeWidth="16" />
                    )}
                    <circle cx="140" cy="54" r="36" stroke="#22c55e" strokeWidth="2" strokeDasharray="4 3" fill="none" />
                    <text x="140" y="142" textAnchor="middle" fill="#a1a1aa" fontSize="9" fontFamily="monospace">CLOSE-UP 1–2 FT • WELD / COLLAR CLEARLY IN FRAME</text>
                </g>
            )}
            {slotId === 'post_mount_base' && (
                <g>
                    {isWall ? (
                        <>
                            <rect x="30" y="20" width="220" height="100" fill="#18181b" stroke="#27272a" />
                            <circle cx="140" cy="70" r="26" fill="#3f3f46" stroke="#f59e0b" strokeWidth="3" />
                            <circle cx="127" cy="70" r="4" fill="#fafafa" />
                            <circle cx="153" cy="70" r="4" fill="#fafafa" />
                            <text x="140" y="142" textAnchor="middle" fill="#a1a1aa" fontSize="9" fontFamily="monospace">WALL ESCUTCHEON & ANCHOR SCREWS (1 FT)</text>
                        </>
                    ) : (
                        <>
                            <rect x="40" y="96" width="200" height="24" fill="#27272a" />
                            <rect x="128" y="20" width="22" height="92" fill="#f59e0b" />
                            <rect x="108" y="88" width="62" height="10" rx="2" fill="#e4e4e7" />
                            <circle cx="139" cy="102" r="3" fill="#18181b" />
                            <circle cx="139" cy="112" r="3" fill="#18181b" />
                            <circle cx="140" cy="95" r="38" stroke="#22c55e" strokeWidth="2" strokeDasharray="4 3" fill="none" />
                            <text x="140" y="142" textAnchor="middle" fill="#a1a1aa" fontSize="9" fontFamily="monospace">SHOW FLANGE PLATE OR SIDE 2-BOLT FASCIA CLEARLY</text>
                        </>
                    )}
                </g>
            )}
            {slotId === 'infill_bottom' && (
                <g>
                    <path d="M40 120 L100 120 L100 95 L165 95 L165 70 L235 70" stroke="#3f3f46" strokeWidth="3" fill="none" />
                    <line x1="45" y1="88" x2="230" y2="38" stroke="#f59e0b" strokeWidth="5" />
                    {[70, 100, 130, 160, 190, 220].map((x, idx) => (
                        <line key={x} x1={x} y1={22} x2={x} y2={82 - idx * 8} stroke="#e4e4e7" strokeWidth="3" />
                    ))}
                    <circle cx="145" cy="70" r="38" stroke="#22c55e" strokeWidth="2" strokeDasharray="4 3" fill="none" />
                    <text x="140" y="142" textAnchor="middle" fill="#a1a1aa" fontSize="9" fontFamily="monospace">SHOE RAIL GAP OR DIRECT TREAD EMBED + SPACING</text>
                </g>
            )}
            {slotId === 'end_return' && (
                <g>
                    <rect x="200" y="20" width="40" height="100" fill="#27272a" />
                    <path d="M45 60 L195 60 L195 85 L205 85" stroke="#f59e0b" strokeWidth="10" strokeLinejoin="round" fill="none" />
                    <circle cx="185" cy="70" r="36" stroke="#22c55e" strokeWidth="2" strokeDasharray="4 3" fill="none" />
                    <text x="140" y="142" textAnchor="middle" fill="#a1a1aa" fontSize="9" fontFamily="monospace">END CAP, 90° WALL RETURN, OR MITER TERMINATION</text>
                </g>
            )}
            {(slotId === 'finish_macro' || slotId === 'extra_context') && (
                <g>
                    <rect x="55" y="30" width="170" height="80" rx="8" fill="#18181b" stroke="#52525b" strokeWidth="2" />
                    <line x1="75" y1="55" x2="205" y2="55" stroke="#f59e0b" strokeWidth="10" strokeLinecap="round" />
                    <line x1="75" y1="85" x2="205" y2="85" stroke="#a1a1aa" strokeWidth="4" />
                    <text x="140" y="142" textAnchor="middle" fill="#a1a1aa" fontSize="9" fontFamily="monospace">
                        {slotId === 'finish_macro' ? 'SHEEN / METAL GRAIN / COATING TEXTURE' : 'ADDITIONAL LANDING / TURN ANGLE'}
                    </text>
                </g>
            )}
        </svg>
    );
}

export default function StyleSetupWizard({
    onClose,
    onSuccess,
    existingStyle,
    isAdmin = false,
    adminTenantId,
}: StyleSetupWizardProps) {
    const isUpgradeMode = Boolean(existingStyle?.id);
    const initialCategory: FabricationCategory =
        existingStyle?.style_metadata?.category || 'stair_railing';

    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
    const [activeCoachSlot, setActiveCoachSlot] = useState<StyleSlotId>('hero_run');
    const [helpPopupSlot, setHelpPopupSlot] = useState<StyleSlotDefinition | null>(null);

    // Step 1 state
    const [name, setName] = useState(existingStyle?.name || '');
    const [description, setDescription] = useState(existingStyle?.description || '');
    const [priceMin, setPriceMin] = useState(
        existingStyle?.price_per_ft_min ? String(existingStyle.price_per_ft_min) : ''
    );
    const [priceMax, setPriceMax] = useState(
        existingStyle?.price_per_ft_max ? String(existingStyle.price_per_ft_max) : ''
    );
    const [category, setCategory] = useState<FabricationCategory>(initialCategory);

    // Step 2 labeled slots state (prefill hero & legacy detail images if upgrading!)
    const [slotUrls, setSlotUrls] = useState<Partial<Record<StyleSlotId, string[]>>>(() => {
        if (existingStyle?.style_metadata?.labeled_slots) {
            return existingStyle.style_metadata.labeled_slots;
        }
        const seed: Partial<Record<StyleSlotId, string[]>> = {};
        if (existingStyle?.image_url) seed.hero_run = [existingStyle.image_url];
        const legacyDetails = existingStyle?.style_metadata?.second_pass?.detail_images || {};
        if (legacyDetails.reducers || legacyDetails.reducer_fittings) {
            seed.post_top_joint = [legacyDetails.reducers || legacyDetails.reducer_fittings];
        }
        if (legacyDetails.side_mount || legacyDetails.top_mount) {
            seed.post_mount_base = [legacyDetails.side_mount || legacyDetails.top_mount];
        }
        if (legacyDetails.shoe_rail || legacyDetails.direct_mount) {
            seed.infill_bottom = [legacyDetails.shoe_rail || legacyDetails.direct_mount];
        }
        return seed;
    });

    const [slotValidation, setSlotValidation] = useState<Record<string, SlotValidationState>>({});
    const [uploadingSlot, setUploadingSlot] = useState<StyleSlotId | null>(null);

    // Legacy pool so shops upgrading an existing style can assign legacy reference_images to slots in 1 click
    const legacyUnassignedPool = useMemo(() => {
        if (!existingStyle) return [];
        const allLegacy = Array.from(
            new Set([existingStyle.image_url, ...(existingStyle.reference_images || [])].filter(Boolean))
        ) as string[];
        const alreadyAssigned = new Set(Object.values(slotUrls).flat().filter(Boolean) as string[]);
        return allLegacy.filter((u) => !alreadyAssigned.has(u));
    }, [existingStyle, slotUrls]);

    // Step 3 Fabrication Spec & Canonical Cutout
    const [fabSpec, setFabSpec] = useState<FabricationSpec>(() => {
        if (existingStyle?.style_metadata?.fabrication_spec) {
            return existingStyle.style_metadata.fabrication_spec;
        }
        const base = DEFAULT_FAB_SPEC(initialCategory);
        if (existingStyle) {
            base.has_bottom_rail = Boolean(existingStyle.has_bottom_rail);
            if (existingStyle.post_mount === 'side' || existingStyle.style_metadata?.post_mount === 'side') {
                base.post_mount_type = 'side';
                base.bolt_pattern = '2 vertically stacked hex through-bolts direct to fascia (no plate)';
            } else if (existingStyle.post_mount === 'top') {
                base.post_mount_type = 'top';
            }
            if (existingStyle.has_reducers === true) base.post_to_rail_joint = 'stem_reducer';
            else if (existingStyle.has_reducers === false) base.post_to_rail_joint = 'direct_flush_weld';
        }
        return base;
    });
    const [extractingSpec, setExtractingSpec] = useState(false);
    const [specExtractedOnce, setSpecExtractedOnce] = useState(
        Boolean(existingStyle?.style_metadata?.fabrication_spec)
    );
    const [canonicalUrl, setCanonicalUrl] = useState<string>(
        existingStyle?.style_metadata?.canonical_image_url || ''
    );
    const [useCanonicalCutout, setUseCanonicalCutout] = useState<boolean>(
        Boolean(existingStyle?.style_metadata?.use_canonical_cutout)
    );
    const [generatingCutout, setGeneratingCutout] = useState(false);

    // Step 4 Benchmark Calibration
    const [presets, setPresets] = useState<BenchmarkPresetInfo[]>([]);
    const [selectedPresetId, setSelectedPresetId] = useState<string>('interior_hardwood');
    const [freeUsed, setFreeUsed] = useState<number>(
        Number(existingStyle?.style_metadata?.free_calibration_used || 0)
    );
    const [calibrationImage, setCalibrationImage] = useState<string | null>(null);
    const [calibrationBusy, setCalibrationBusy] = useState(false);
    const [calibrationApproved, setCalibrationApproved] = useState<boolean>(
        Boolean(existingStyle?.style_metadata?.calibration_approved)
    );
    const [needsCreditPrompt, setNeedsCreditPrompt] = useState(false);
    const [showAdjustPanel, setShowAdjustPanel] = useState(false);
    const [adjustNote, setAdjustNote] = useState('');
    const [adminReviewSent, setAdminReviewSent] = useState(
        Boolean(existingStyle?.style_metadata?.admin_review_requested)
    );

    const [saving, setSaving] = useState(false);
    const [errorBanner, setErrorBanner] = useState<string | null>(null);

    useEffect(() => {
        getBenchmarkPresets().then(setPresets).catch(() => {});
    }, []);

    const requiredFilledCount = STYLE_PHOTO_SLOTS.filter(
        (s) => s.required && (slotUrls[s.id]?.length || 0) > 0
    ).length;

    const totalUploadedPhotos = Object.values(slotUrls).reduce(
        (acc, list) => acc + (list?.length || 0),
        0
    );

    const isWallHandrail = category === 'wall_handrail';
    const isStep2Valid =
        requiredFilledCount === MIN_WIZARD_REQUIRED_SLOTS &&
        totalUploadedPhotos <= MAX_WIZARD_TOTAL_PHOTOS;

    const handleSlotFileUpload = async (slotDef: StyleSlotDefinition, files: FileList | null) => {
        if (!files || files.length === 0) return;
        setErrorBanner(null);
        setActiveCoachSlot(slotDef.id);

        const existingList = slotUrls[slotDef.id] || [];
        const remainingForSlot = slotDef.maxCount - existingList.length;
        const remainingTotal = MAX_WIZARD_TOTAL_PHOTOS - totalUploadedPhotos;
        if (remainingForSlot <= 0 || remainingTotal <= 0) {
            setErrorBanner(`Slot limit reached (Max ${slotDef.maxCount} in this slot, Max ${MAX_WIZARD_TOTAL_PHOTOS} total photos).`);
            return;
        }

        setUploadingSlot(slotDef.id);
        const supabase = createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        const tenantBucketPrefix = adminTenantId || user?.id || 'shared';

        try {
            const targetFile = files[0];
            let processedFile = targetFile;
            const isHeic =
                targetFile.type === 'image/heic' ||
                targetFile.name.toLowerCase().endsWith('.heic') ||
                targetFile.name.toLowerCase().endsWith('.heif');
            if (isHeic) {
                const fd = new FormData();
                fd.append('file', targetFile);
                const conv = await convertHeicToJpg(fd);
                if (conv.success && conv.base64) {
                    const blob = await (await fetch(conv.base64)).blob();
                    processedFile = new File([blob], targetFile.name.replace(/\.(heic|heif)$/i, '.jpg'), {
                        type: 'image/jpeg',
                    });
                }
            }

            const compressed = await compressImage(processedFile, 2048, 0.92);
            const pathKey = `${tenantBucketPrefix}/${Date.now()}_${slotDef.id}_${Math.random()
                .toString(36)
                .slice(2, 7)}.jpg`;

            const { error: upErr } = await supabase.storage
                .from('portfolio')
                .upload(pathKey, compressed, { contentType: 'image/jpeg', upsert: false });

            if (upErr) {
                throw new Error(upErr.message);
            }

            const { data: pub } = supabase.storage.from('portfolio').getPublicUrl(pathKey);
            const uploadedUrl = pub.publicUrl;

            setSlotUrls((prev) => ({
                ...prev,
                [slotDef.id]:
                    slotDef.maxCount === 1 ? [uploadedUrl] : [...(prev[slotDef.id] || []), uploadedUrl].slice(0, slotDef.maxCount),
            }));

            // Live Gemini 3.8 Flash coaching check
            setSlotValidation((prev) => ({ ...prev, [uploadedUrl]: { checking: true } }));
            const valFd = new FormData();
            valFd.append('slot_id', slotDef.id);
            valFd.append('category', category);
            valFd.append('file', compressed);
            const valRes = await validateWizardSlotPhoto(valFd);
            if (valRes.success && valRes.result) {
                setSlotValidation((prev) => ({
                    ...prev,
                    [uploadedUrl]: { checking: false, ...valRes.result },
                }));
            } else {
                setSlotValidation((prev) => ({
                    ...prev,
                    [uploadedUrl]: { checking: false, valid: true, qualityScore: 85, feedback: 'Uploaded cleanly.' },
                }));
            }
        } catch (err: any) {
            setErrorBanner(`Upload error (${slotDef.title}): ${err?.message || 'Failed'}`);
        } finally {
            setUploadingSlot(null);
        }
    };

    const assignExistingUrlToSlot = async (slotDef: StyleSlotDefinition, url: string) => {
        setActiveCoachSlot(slotDef.id);
        setSlotUrls((prev) => ({
            ...prev,
            [slotDef.id]:
                slotDef.maxCount === 1
                    ? [url]
                    : Array.from(new Set([...(prev[slotDef.id] || []), url])).slice(0, slotDef.maxCount),
        }));
    };

    const removeUrlFromSlot = (slotId: StyleSlotId, url: string) => {
        setSlotUrls((prev) => {
            const next = (prev[slotId] || []).filter((u) => u !== url);
            return { ...prev, [slotId]: next };
        });
    };

    const runExtractFabSpec = async () => {
        setExtractingSpec(true);
        setErrorBanner(null);
        try {
            const fd = new FormData();
            fd.append('labeled_slots', JSON.stringify(slotUrls));
            fd.append('category', category);
            fd.append('name', name);
            fd.append('description', description);
            const res = await extractWizardFabSpec(fd);
            if (res.success && res.spec) {
                setFabSpec(res.spec);
                setSpecExtractedOnce(true);
            } else if (res.error) {
                setErrorBanner(res.error);
            }
        } catch (err: any) {
            setErrorBanner(err?.message || 'Could not extract fabrication specification.');
        } finally {
            setExtractingSpec(false);
        }
    };

    const handleGoStep3 = () => {
        setStep(3);
        if (!specExtractedOnce) {
            void runExtractFabSpec();
        }
    };

    const handleGenerateCutout = async () => {
        setGeneratingCutout(true);
        setErrorBanner(null);
        try {
            const fd = new FormData();
            fd.append('labeled_slots', JSON.stringify(slotUrls));
            fd.append('fabrication_spec', JSON.stringify(fabSpec));
            const res = await generateWizardCanonicalCutout(fd);
            if (res.success && res.canonicalUrl) {
                setCanonicalUrl(res.canonicalUrl);
                setUseCanonicalCutout(true);
            } else {
                setErrorBanner(res.error || 'Studio cutout generation failed.');
            }
        } catch (err: any) {
            setErrorBanner(err?.message || 'Studio cutout failed.');
        } finally {
            setGeneratingCutout(false);
        }
    };

    const handleRunCalibration = async (spendCreditOverride = false) => {
        setCalibrationBusy(true);
        setErrorBanner(null);
        setNeedsCreditPrompt(false);
        try {
            const fd = new FormData();
            fd.append('preset_id', selectedPresetId);
            if (existingStyle?.id) fd.append('style_id', existingStyle.id);
            fd.append('draft_free_used', String(freeUsed));
            fd.append('labeled_slots', JSON.stringify(slotUrls));
            fd.append('fabrication_spec', JSON.stringify(fabSpec));
            fd.append('name', name || 'Custom Style');
            fd.append('description', description || '');
            if (canonicalUrl) fd.append('canonical_image_url', canonicalUrl);
            fd.append('use_canonical_cutout', String(useCanonicalCutout));
            if (spendCreditOverride) fd.append('allow_credit_spend', 'true');

            const res = await runStyleCalibrationTest(fd);
            if ((res as any).requiresCreditConsent) {
                setNeedsCreditPrompt(true);
                return;
            }
            if (!res.success || !res.image) {
                setErrorBanner(res.error || 'Calibration render failed.');
                return;
            }
            setCalibrationImage(res.image);
            if (typeof res.freeUsed === 'number') {
                setFreeUsed(res.freeUsed);
            }
        } catch (err: any) {
            setErrorBanner(err?.message || 'Calibration test failed.');
        } finally {
            setCalibrationBusy(false);
        }
    };

    const handleRequestAdminReview = async () => {
        if (existingStyle?.id) {
            const res = await flagStyleForAdminReview(existingStyle.id, adjustNote || 'Requested calibration review');
            if (res.success) {
                setAdminReviewSent(true);
            } else {
                setErrorBanner(res.error || 'Failed to flag for review.');
            }
        } else {
            setAdminReviewSent(true);
        }
    };

    const handleSaveStyle = async () => {
        if (!name.trim() || !isStep2Valid) {
            setErrorBanner('Style name and all 5 required photo slots must be completed before saving.');
            return;
        }
        setSaving(true);
        setErrorBanner(null);

        try {
            const heroUrl = slotUrls.hero_run?.[0] || '';
            const orderedRefs = [
                ...(slotUrls.post_top_joint || []),
                ...(slotUrls.post_mount_base || []),
                ...(slotUrls.infill_bottom || []),
                ...(slotUrls.end_return || []),
                ...(slotUrls.finish_macro || []),
                ...(slotUrls.extra_context || []),
            ].filter(Boolean);

            const fd = new FormData();
            fd.append('wizard_mode', 'v2');
            fd.append('wizard_category', category);
            fd.append('name', name.trim());
            fd.append('description', description.trim());
            if (priceMin) fd.append('price_min', priceMin);
            if (priceMax) fd.append('price_max', priceMax);

            fd.append('labeled_slots', JSON.stringify(slotUrls));
            fd.append('fabrication_spec', JSON.stringify(fabSpec));
            fd.append('has_bottom_rail', String(Boolean(fabSpec.has_bottom_rail)));
            if (fabSpec.post_to_rail_joint === 'direct_flush_weld') {
                fd.append('has_reducers', 'false');
            } else if (fabSpec.post_to_rail_joint === 'stem_reducer') {
                fd.append('has_reducers', 'true');
            }
            fd.append(
                'post_mount',
                fabSpec.post_mount_type === 'side' ? 'side' : 'top'
            );

            if (canonicalUrl) fd.append('canonical_image_url', canonicalUrl);
            fd.append('use_canonical_cutout', String(useCanonicalCutout));
            fd.append('calibration_approved', String(calibrationApproved || Boolean(calibrationImage)));
            fd.append('free_calibration_used', String(freeUsed));
            if (isAdmin && adminTenantId) {
                fd.append('admin_tenant_id', adminTenantId);
            }

            if (existingStyle?.id) {
                fd.append('style_id', existingStyle.id);
                fd.append('new_image_url', heroUrl);
                fd.append('kept_reference_urls', JSON.stringify(orderedRefs));
                const res = await updateStyle(fd);
                if (res?.error) throw new Error(res.error);
            } else {
                fd.append('image_url', heroUrl);
                fd.append('reference_urls', JSON.stringify(orderedRefs));
                const res = await createStyle(fd);
                if (res?.error) throw new Error(res.error);
            }

            onSuccess();
        } catch (err: any) {
            setErrorBanner(err?.message || 'Failed to save style.');
        } finally {
            setSaving(false);
        }
    };

    const focusedSlotDef =
        STYLE_PHOTO_SLOTS.find((s) => s.id === activeCoachSlot) || STYLE_PHOTO_SLOTS[0];

    return (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <div className="bg-[#0b0b0c] border border-white/15 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden shadow-2xl">
                {/* Top Header + Stepper */}
                <div className="px-5 py-4 border-b border-white/10 bg-[#121215] flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Sparkles size={16} className="text-[var(--primary)]" />
                            <h3 className="text-lg font-black uppercase tracking-tight text-white">
                                {isUpgradeMode ? `Guided Upgrade: ${existingStyle?.name}` : 'Guided Self-Serve Style Setup'}
                            </h3>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                            5 required reference angles + verified Fabrication Spec for consistent AI accuracy
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {[
                            { num: 1, label: '1. Basics' },
                            { num: 2, label: `2. Photos (${requiredFilledCount}/5)` },
                            { num: 3, label: '3. Fab Spec' },
                            { num: 4, label: '4. Calibrate' },
                        ].map((s) => {
                            const disabled = (s.num === 3 || s.num === 4) && !isStep2Valid;
                            return (
                                <button
                                    key={s.num}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => {
                                        if (s.num === 3) handleGoStep3();
                                        else setStep(s.num as 1 | 2 | 3 | 4);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                                        step === s.num
                                            ? 'bg-[var(--primary)] text-black shadow'
                                            : disabled
                                            ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                                            : 'bg-white/5 text-gray-300 hover:bg-white/10'
                                    }`}
                                >
                                    {s.label}
                                </button>
                            );
                        })}

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg ml-2"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {errorBanner && (
                    <div className="mx-5 mt-3 p-3 rounded-lg bg-red-950/70 border border-red-500/40 text-red-200 text-xs flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2">
                            <AlertTriangle size={14} className="text-red-400 shrink-0" />
                            {errorBanner}
                        </span>
                        <button type="button" onClick={() => setErrorBanner(null)} className="text-red-300 hover:text-white">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Body: Left Workspace + Right Persistent Coaching Drawer */}
                <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
                    <div className="lg:col-span-8 overflow-y-auto p-5 space-y-5 border-r border-white/5">
                        {/* STEP 1 */}
                        {step === 1 && (
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">
                                        Style Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder='e.g., "Cascade 2-Bolt Side Mount Cable" or "Heritage Forge Seamless"'
                                        className="w-full bg-black border border-white/15 rounded-lg px-3.5 py-2.5 text-sm text-white focus:border-[var(--primary)] outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">
                                        System Category *
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                        {[
                                            { id: 'stair_railing', label: 'Stair Railing', sub: 'Posts + infill on steps' },
                                            { id: 'wall_handrail', label: 'Wall Handrail', sub: 'Grab rail + wall brackets' },
                                            { id: 'guardrail', label: 'Guardrail', sub: 'Level deck / loft / balcony' },
                                            { id: 'hybrid', label: 'Hybrid System', sub: 'Stair + wall return mix' },
                                        ].map((cat) => (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => {
                                                    const nextCat = cat.id as FabricationCategory;
                                                    setCategory(nextCat);
                                                    setFabSpec((prev) => ({
                                                        ...prev,
                                                        category: nextCat,
                                                        post_mount_type:
                                                            nextCat === 'wall_handrail'
                                                                ? 'wall'
                                                                : prev.post_mount_type === 'wall'
                                                                ? 'top'
                                                                : prev.post_mount_type,
                                                    }));
                                                }}
                                                className={`p-3 rounded-xl border text-left transition-all ${
                                                    category === cat.id
                                                        ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-white'
                                                        : 'border-white/10 bg-zinc-950 text-gray-400 hover:border-white/25'
                                                }`}
                                            >
                                                <div className="font-bold text-xs">{cat.label}</div>
                                                <div className="text-[11px] opacity-75 mt-0.5">{cat.sub}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">
                                        Shop Description (Homeowner Facing + AI Context)
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Describe material sheen, profile size, cable/picket look, and any signature shop details..."
                                        className="w-full bg-black border border-white/15 rounded-lg px-3.5 py-2.5 text-sm text-white focus:border-[var(--primary)] outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">
                                            Estimate Min ($/ft)
                                        </label>
                                        <input
                                            type="number"
                                            value={priceMin}
                                            onChange={(e) => setPriceMin(e.target.value)}
                                            placeholder="125"
                                            className="w-full bg-black border border-white/15 rounded-lg px-3.5 py-2 text-sm text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">
                                            Estimate Max ($/ft)
                                        </label>
                                        <input
                                            type="number"
                                            value={priceMax}
                                            onChange={(e) => setPriceMax(e.target.value)}
                                            placeholder="195"
                                            className="w-full bg-black border border-white/15 rounded-lg px-3.5 py-2 text-sm text-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 2 */}
                        {step === 2 && (
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-900/70 border border-white/10 rounded-xl p-3">
                                    <div className="text-xs text-gray-300">
                                        <span className="font-bold text-white">Required Slots: {requiredFilledCount} / {MIN_WIZARD_REQUIRED_SLOTS}</span>
                                        <span className="mx-2 text-gray-600">|</span>
                                        <span>Total Photos: {totalUploadedPhotos} / {MAX_WIZARD_TOTAL_PHOTOS} Max</span>
                                    </div>
                                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${isStep2Valid ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-amber-950 text-amber-300 border border-amber-500/40'}`}>
                                        {isStep2Valid ? 'Ready for Fab Spec' : 'Fill Slots 1–5 to continue'}
                                    </span>
                                </div>

                                {legacyUnassignedPool.length > 0 && (
                                    <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/30 space-y-2">
                                        <div className="text-xs font-bold text-blue-200">
                                            Legacy Photos Ready to Quick-Assign into Labeled Slots:
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {legacyUnassignedPool.map((url, idx) => (
                                                <div key={idx} className="flex items-center gap-2 bg-black/70 border border-white/15 rounded-lg p-1.5">
                                                    <img src={url} alt="" className="w-10 h-10 object-cover rounded" />
                                                    <button
                                                        type="button"
                                                        onClick={() => assignExistingUrlToSlot(focusedSlotDef, url)}
                                                        className="text-[11px] px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                                                    >
                                                        Assign to Slot {focusedSlotDef.slotNumber}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 gap-3">
                                    {STYLE_PHOTO_SLOTS.map((slotDef) => {
                                        const urls = slotUrls[slotDef.id] || [];
                                        const title = isWallHandrail && slotDef.wallHandrailTitle ? slotDef.wallHandrailTitle : slotDef.title;
                                        const instruction = isWallHandrail && slotDef.wallHandrailShortInstruction
                                            ? slotDef.wallHandrailShortInstruction
                                            : slotDef.shortInstruction;
                                        const isActive = activeCoachSlot === slotDef.id;
                                        const canAddMore = urls.length < slotDef.maxCount && totalUploadedPhotos < MAX_WIZARD_TOTAL_PHOTOS;

                                        return (
                                            <div
                                                key={slotDef.id}
                                                onClick={() => setActiveCoachSlot(slotDef.id)}
                                                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                                                    isActive
                                                        ? 'border-[var(--primary)] bg-white/[0.03]'
                                                        : 'border-white/10 bg-zinc-950/60 hover:border-white/25'
                                                }`}
                                            >
                                                <div className="flex flex-wrap items-start justify-between gap-2">
                                                    <div className="space-y-0.5 max-w-xl">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-mono font-bold text-[var(--primary)]">
                                                                SLOT {slotDef.slotNumber}
                                                            </span>
                                                            <h4 className="text-sm font-bold text-white">{title}</h4>
                                                            <span
                                                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase ${
                                                                    slotDef.required
                                                                        ? urls.length > 0
                                                                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                                                            : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                                                                        : 'bg-zinc-900 text-zinc-400 border border-white/10'
                                                                }`}
                                                            >
                                                                {slotDef.required ? (urls.length > 0 ? 'Complete' : 'Required') : `Optional (0–${slotDef.maxCount})`}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-gray-400">{instruction}</p>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setHelpPopupSlot(slotDef);
                                                            }}
                                                            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-200 flex items-center gap-1"
                                                        >
                                                            <HelpCircle size={13} className="text-[var(--primary)]" />
                                                            Photo Examples
                                                        </button>

                                                        {canAddMore && (
                                                            <label
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-black font-bold text-xs cursor-pointer hover:brightness-110 flex items-center gap-1.5"
                                                            >
                                                                {uploadingSlot === slotDef.id ? (
                                                                    <Loader2 size={13} className="animate-spin" />
                                                                ) : (
                                                                    <Upload size={13} />
                                                                )}
                                                                {urls.length > 0 ? 'Add / Replace' : 'Upload'}
                                                                <input
                                                                    type="file"
                                                                    accept="image/*,.heic,.heif"
                                                                    className="hidden"
                                                                    onChange={(e) => {
                                                                        void handleSlotFileUpload(slotDef, e.target.files);
                                                                        e.target.value = '';
                                                                    }}
                                                                />
                                                            </label>
                                                        )}
                                                    </div>
                                                </div>

                                                {urls.length > 0 && (
                                                    <div className="mt-3 flex flex-wrap gap-3">
                                                        {urls.map((u) => {
                                                            const vState = slotValidation[u];
                                                            return (
                                                                <div
                                                                    key={u}
                                                                    className="flex items-center gap-2.5 bg-black/80 border border-white/15 rounded-lg p-2 pr-3 max-w-full"
                                                                >
                                                                    <img
                                                                        src={u}
                                                                        alt={title}
                                                                        className="w-14 h-14 object-cover rounded border border-white/10 shrink-0"
                                                                    />
                                                                    <div className="min-w-0">
                                                                        {vState?.checking ? (
                                                                            <span className="text-[11px] font-mono text-gray-400 flex items-center gap-1">
                                                                                <Loader2 size={11} className="animate-spin" /> Inspecting clarity & framing...
                                                                            </span>
                                                                        ) : vState ? (
                                                                            <div className="space-y-0.5">
                                                                                <div className={`text-[11px] font-mono font-bold flex items-center gap-1 ${vState.valid === false ? 'text-amber-300' : 'text-emerald-300'}`}>
                                                                                    {vState.valid === false ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                                                                                    AI Quality {vState.qualityScore ?? 85}/100
                                                                                </div>
                                                                                {vState.feedback && (
                                                                                    <p className="text-[11px] text-gray-300 line-clamp-2 max-w-xs">
                                                                                        {vState.feedback}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-[11px] font-mono text-emerald-300 flex items-center gap-1">
                                                                                <Check size={11} /> Photo attached
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            removeUrlFromSlot(slotDef.id, u);
                                                                        }}
                                                                        className="p-1 text-gray-500 hover:text-red-400"
                                                                        title="Remove photo"
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* STEP 3: Editable Fabrication Spec + Optional Studio Cutout */}
                        {step === 3 && (
                            <div className="space-y-5">
                                <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-900/70 border border-white/10 rounded-xl p-3.5">
                                    <div>
                                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                            <Wrench size={15} className="text-[var(--primary)]" />
                                            Editable Fabrication Specification
                                        </h4>
                                        <p className="text-xs text-gray-400">
                                            Verify and correct any material, tube/bar dimension, joint weld, mount hardware, or finish below.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={extractingSpec}
                                        onClick={() => void runExtractFabSpec()}
                                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center gap-1.5"
                                    >
                                        {extractingSpec ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                                        {extractingSpec ? 'Analyzing Slots...' : 'Re-Extract from Photos'}
                                    </button>
                                </div>

                                {fabSpec.conflicts_detected && fabSpec.conflicts_detected.length > 0 && (
                                    <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-500/40 space-y-1">
                                        <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                                            <AlertTriangle size={14} />
                                            AI Detected Potential Cross-Photo Conflicts — Please Verify Below:
                                        </div>
                                        <ul className="list-disc pl-5 text-xs text-amber-100/90 space-y-0.5">
                                            {fabSpec.conflicts_detected.map((c, idx) => (
                                                <li key={idx}>{c}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-mono uppercase text-gray-400 mb-1">Material</label>
                                        <input
                                            type="text"
                                            value={fabSpec.material}
                                            onChange={(e) => setFabSpec({ ...fabSpec, material: e.target.value })}
                                            className="w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-mono uppercase text-gray-400 mb-1">Color & Sheen Finish</label>
                                        <input
                                            type="text"
                                            value={fabSpec.finish}
                                            onChange={(e) => setFabSpec({ ...fabSpec, finish: e.target.value })}
                                            className="w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-mono uppercase text-gray-400 mb-1">Top Rail Profile & Size</label>
                                        <input
                                            type="text"
                                            value={fabSpec.top_rail_profile}
                                            onChange={(e) => setFabSpec({ ...fabSpec, top_rail_profile: e.target.value })}
                                            className="w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-mono uppercase text-gray-400 mb-1">Post Profile & Size</label>
                                        <input
                                            type="text"
                                            value={fabSpec.post_profile}
                                            onChange={(e) => setFabSpec({ ...fabSpec, post_profile: e.target.value })}
                                            className="w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-mono uppercase text-gray-400 mb-1">Post Mounting Style</label>
                                        <select
                                            value={fabSpec.post_mount_type}
                                            onChange={(e) =>
                                                setFabSpec({ ...fabSpec, post_mount_type: e.target.value as FabricationPostMount })
                                            }
                                            className="w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                                        >
                                            <option value="top">Top / Surface Flange Mount (on treads)</option>
                                            <option value="side">Side / Fascia Mount (direct outer stringer)</option>
                                            <option value="wall">Wall-Mounted Brackets (no posts)</option>
                                            <option value="mixed">Mixed (Stair Side + Deck Top)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-mono uppercase text-gray-400 mb-1">Bolt / Fastener Pattern</label>
                                        <input
                                            type="text"
                                            value={fabSpec.bolt_pattern}
                                            onChange={(e) => setFabSpec({ ...fabSpec, bolt_pattern: e.target.value })}
                                            className="w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-mono uppercase text-gray-400 mb-1">Post-to-Top-Rail Joint</label>
                                        <select
                                            value={fabSpec.post_to_rail_joint}
                                            onChange={(e) =>
                                                setFabSpec({ ...fabSpec, post_to_rail_joint: e.target.value as FabricationJointType })
                                            }
                                            className="w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                                        >
                                            <option value="direct_flush_weld">Direct Seamless Flush Weld (No Pins/Collars)</option>
                                            <option value="stem_reducer">Stem Reducer / Transition Collar</option>
                                            <option value="bracket_saddle">Post Saddle / Pivot Bracket</option>
                                            <option value="wall_bracket">Wall Bracket Stem</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-mono uppercase text-gray-400 mb-1">Infill System Type</label>
                                        <select
                                            value={fabSpec.infill_type}
                                            onChange={(e) =>
                                                setFabSpec({ ...fabSpec, infill_type: e.target.value as FabricationInfillType })
                                            }
                                            className="w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                                        >
                                            <option value="vertical_pickets">Vertical Pickets / Balusters</option>
                                            <option value="horizontal_bars">Horizontal Solid Bars / Channels</option>
                                            <option value="horizontal_cable">Stainless Steel Cable</option>
                                            <option value="tempered_glass">Tempered Glass Panels</option>
                                            <option value="mesh_panel">Perforated / Wire Mesh Panel</option>
                                            <option value="custom_scroll">Ornamental / Forged Scrollwork</option>
                                            <option value="none_wall_only">None (Wall Grab Rail)</option>
                                        </select>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-[11px] font-mono uppercase text-gray-400 mb-1">Infill Bar Size & Center Spacing</label>
                                        <input
                                            type="text"
                                            value={fabSpec.infill_profile_and_spacing}
                                            onChange={(e) => setFabSpec({ ...fabSpec, infill_profile_and_spacing: e.target.value })}
                                            className="w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-mono uppercase text-gray-400 mb-1">Bottom Shoe Rail</label>
                                        <div className="flex gap-2">
                                            {[
                                                { val: true, label: 'Has Bottom Shoe Rail' },
                                                { val: false, label: 'No Bottom Rail (Direct Tread)' },
                                            ].map((opt) => (
                                                <button
                                                    key={String(opt.val)}
                                                    type="button"
                                                    onClick={() => setFabSpec({ ...fabSpec, has_bottom_rail: opt.val })}
                                                    className={`flex-1 py-2 px-2.5 rounded-lg border text-xs font-semibold ${
                                                        fabSpec.has_bottom_rail === opt.val
                                                            ? 'border-[var(--primary)] bg-[var(--primary)]/15 text-white'
                                                            : 'border-white/10 bg-black text-gray-400'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-mono uppercase text-gray-400 mb-1">Bottom Termination Details</label>
                                        <input
                                            type="text"
                                            value={fabSpec.bottom_termination}
                                            onChange={(e) => setFabSpec({ ...fabSpec, bottom_termination: e.target.value })}
                                            className="w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-[11px] font-mono uppercase text-gray-400 mb-1">Handrail End Cap / Wall Return Detail</label>
                                        <input
                                            type="text"
                                            value={fabSpec.handrail_return}
                                            onChange={(e) => setFabSpec({ ...fabSpec, handrail_return: e.target.value })}
                                            className="w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                                        />
                                    </div>
                                </div>

                                {/* Optional Studio Specimen Cutout */}
                                <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <div className="text-xs font-bold text-white">
                                                Optional Studio Specimen Cutout (Neutral Background Isolation)
                                            </div>
                                            <div className="text-[11px] text-gray-400">
                                                Helpful if your Hero photo has a busy porch/backyard. Always inspect before enabling.
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={generatingCutout}
                                            onClick={() => void handleGenerateCutout()}
                                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center gap-1.5"
                                        >
                                            {generatingCutout ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                                            {canonicalUrl ? 'Regenerate Studio Specimen' : 'Generate Studio Specimen'}
                                        </button>
                                    </div>

                                    {canonicalUrl && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
                                            <div>
                                                <div className="text-[10px] font-mono text-gray-400 mb-1">Original Hero Photo</div>
                                                <img src={slotUrls.hero_run?.[0]} alt="" className="w-full h-36 object-cover rounded-lg border border-white/10" />
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-mono text-gray-400 mb-1">Generated Studio Specimen</div>
                                                <img src={canonicalUrl} alt="" className="w-full h-36 object-contain bg-[#F4F5F7] rounded-lg border border-white/10" />
                                            </div>
                                            <label className="sm:col-span-2 flex items-center gap-2 text-xs text-gray-200 cursor-pointer pt-1">
                                                <input
                                                    type="checkbox"
                                                    checked={useCanonicalCutout}
                                                    onChange={(e) => setUseCanonicalCutout(e.target.checked)}
                                                    className="accent-[var(--primary)]"
                                                />
                                                Approve & use Studio Specimen as primary AI Hero Reference (otherwise original Hero photo is kept)
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* STEP 4: Calibration Testing (3 Free Renders) */}
                        {step === 4 && (
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-900/70 border border-white/10 rounded-xl p-3.5">
                                    <div>
                                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                            <ShieldCheck size={16} className="text-emerald-400" />
                                            Test Style on Standard Benchmark Staircases
                                        </h4>
                                        <p className="text-xs text-gray-400">
                                            Verify AI replication before publishing. You receive <strong>{MAX_FREE_CALIBRATION_RENDERS} free calibration renders</strong> per style.
                                        </p>
                                    </div>
                                    <div className="text-xs font-mono px-2.5 py-1 rounded-full bg-black border border-white/15 text-emerald-300">
                                        {isAdmin ? 'Admin Free Mode' : `${Math.max(0, MAX_FREE_CALIBRATION_RENDERS - freeUsed)} / ${MAX_FREE_CALIBRATION_RENDERS} Free Remaining`}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                    {presets.map((p) => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => setSelectedPresetId(p.id)}
                                            className={`rounded-xl border overflow-hidden text-left transition-all ${
                                                selectedPresetId === p.id
                                                    ? 'border-[var(--primary)] ring-1 ring-[var(--primary)] bg-[var(--primary)]/10'
                                                    : 'border-white/10 bg-zinc-950 hover:border-white/30'
                                            }`}
                                        >
                                            <img src={p.url} alt={p.label} className="w-full h-20 object-cover" />
                                            <div className="p-2">
                                                <div className="text-[11px] font-bold text-white truncate">{p.label}</div>
                                                <div className="text-[10px] text-gray-400 line-clamp-2">{p.subtitle}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                    <button
                                        type="button"
                                        disabled={calibrationBusy}
                                        onClick={() => void handleRunCalibration(false)}
                                        className="px-4 py-2.5 rounded-xl bg-[var(--primary)] text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:brightness-110 disabled:opacity-50"
                                    >
                                        {calibrationBusy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                        {calibrationBusy ? 'Rendering 2K Calibration...' : 'Run Benchmark Calibration Render'}
                                    </button>

                                    {calibrationImage && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setCalibrationApproved(true);
                                                    setShowAdjustPanel(false);
                                                }}
                                                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                                                    calibrationApproved
                                                        ? 'bg-emerald-600 text-white border-emerald-500'
                                                        : 'bg-emerald-950/60 text-emerald-200 border-emerald-500/40 hover:bg-emerald-900/60'
                                                }`}
                                            >
                                                <CheckCircle2 size={14} /> Looks Accurate — Ready to Publish
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setShowAdjustPanel((prev) => !prev)}
                                                className="px-3.5 py-2.5 rounded-xl text-xs font-bold border border-amber-500/40 bg-amber-950/40 text-amber-200 hover:bg-amber-900/40"
                                            >
                                                Needs Adjustment
                                            </button>
                                        </>
                                    )}
                                </div>

                                {needsCreditPrompt && (
                                    <div className="p-4 rounded-xl bg-amber-950/50 border border-amber-500/40 space-y-2.5">
                                        <div className="text-xs font-bold text-amber-200">
                                            All {MAX_FREE_CALIBRATION_RENDERS} Free Calibration Renders Used for This Style
                                        </div>
                                        <p className="text-xs text-amber-100/80">
                                            You can refine your Fabrication Spec / photos for free first, run 1 additional test using 1 account credit, or request a free specialist review.
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => void handleRunCalibration(true)}
                                                className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-black text-xs font-bold"
                                            >
                                                Use 1 Credit & Test Again
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleRequestAdminReview()}
                                                className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-semibold hover:bg-white/20"
                                            >
                                                Request Free Admin Review
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {showAdjustPanel && (
                                    <div className="p-4 rounded-xl bg-zinc-900/90 border border-amber-500/30 space-y-3">
                                        <div className="text-xs font-bold text-white">
                                            What looked off? Jump directly to the exact fix:
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActiveCoachSlot('post_mount_base');
                                                    setStep(2);
                                                }}
                                                className="p-2.5 text-left rounded-lg bg-black/70 border border-white/10 hover:border-[var(--primary)] text-xs text-gray-200"
                                            >
                                                <strong>Post Mount / Bolts Wrong</strong> → Re-shoot Slot 3 Close-Up
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActiveCoachSlot('post_top_joint');
                                                    setStep(2);
                                                }}
                                                className="p-2.5 text-left rounded-lg bg-black/70 border border-white/10 hover:border-[var(--primary)] text-xs text-gray-200"
                                            >
                                                <strong>Weld / Stem Collar Wrong</strong> → Re-shoot Slot 2 Close-Up
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActiveCoachSlot('infill_bottom');
                                                    setStep(2);
                                                }}
                                                className="p-2.5 text-left rounded-lg bg-black/70 border border-white/10 hover:border-[var(--primary)] text-xs text-gray-200"
                                            >
                                                <strong>Bottom Shoe Rail / Spacing Off</strong> → Re-shoot Slot 4
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setStep(3)}
                                                className="p-2.5 text-left rounded-lg bg-black/70 border border-white/10 hover:border-[var(--primary)] text-xs text-gray-200"
                                            >
                                                <strong>Material / Bar Size / Return Off</strong> → Edit Step 3 Fab Spec
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                                            <input
                                                type="text"
                                                value={adjustNote}
                                                onChange={(e) => setAdjustNote(e.target.value)}
                                                placeholder="Optional note for our support team if requesting free review..."
                                                className="flex-1 min-w-[200px] bg-black border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => void handleRequestAdminReview()}
                                                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white"
                                            >
                                                {adminReviewSent ? '✓ Review Requested' : 'Request Free Admin Review'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {calibrationImage && (
                                    <div className="rounded-xl overflow-hidden border border-white/15 bg-black">
                                        <div className="px-3 py-2 bg-zinc-900 border-b border-white/10 flex items-center justify-between text-[11px] font-mono text-gray-300">
                                            <span>BENCHMARK CALIBRATION OUTPUT (2K)</span>
                                            <span>Automatic Vision QA + Multi-Turn Refinement Applied</span>
                                        </div>
                                        <img
                                            src={calibrationImage}
                                            alt="Calibration output"
                                            className="w-full max-h-[380px] object-contain"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Persistent Coaching Guide */}
                    <aside className="lg:col-span-4 bg-[#101014] p-5 overflow-y-auto space-y-4">
                        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[var(--primary)]">
                            <ImageIcon size={14} />
                            Setup & Photo Coach
                        </div>

                        {step === 1 && (
                            <div className="space-y-3 text-xs text-gray-300">
                                <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 space-y-1.5">
                                    <div className="font-bold text-white">Why Category Matters</div>
                                    <p>
                                        Choosing <strong>Wall Handrail</strong> vs <strong>Stair Railing</strong> adapts our photo checklist and prevents the AI from hallucinating unwanted posts on wall-grab runs.
                                    </p>
                                </div>
                                <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 space-y-1.5">
                                    <div className="font-bold text-white">Self-Serve Pack Standard</div>
                                    <p>
                                        Great close-up photos of your welds, bolts, and end returns eliminate guesswork—no expensive studio photography needed.
                                    </p>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-3 text-xs text-gray-300">
                                <SlotCoachingSvg slotId={focusedSlotDef.id} isWall={isWallHandrail} />
                                <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 space-y-2">
                                    <div className="font-bold text-white">
                                        Slot {focusedSlotDef.slotNumber}: {isWallHandrail && focusedSlotDef.wallHandrailTitle ? focusedSlotDef.wallHandrailTitle : focusedSlotDef.title}
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-mono text-emerald-400 uppercase mb-1">Do This</div>
                                        <ul className="space-y-1 text-gray-300">
                                            {focusedSlotDef.goodTips.map((t, idx) => (
                                                <li key={idx} className="flex items-start gap-1.5">
                                                    <Check size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                                                    <span>{t}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="pt-1 border-t border-white/10">
                                        <div className="text-[11px] font-mono text-amber-400 uppercase mb-1">Avoid</div>
                                        <ul className="space-y-1 text-gray-400">
                                            {focusedSlotDef.avoidTips.map((t, idx) => (
                                                <li key={idx} className="flex items-start gap-1.5">
                                                    <X size={12} className="text-amber-400 shrink-0 mt-0.5" />
                                                    <span>{t}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-3 text-xs text-gray-300">
                                <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 space-y-1.5">
                                    <div className="font-bold text-white">Hardware Override Authority</div>
                                    <p>
                                        Everything you edit on the left becomes an explicit fabrication blueprint sent alongside every customer render—guaranteeing consistent mount style, bar size, finish, and joint type.
                                    </p>
                                </div>
                                <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 space-y-1.5">
                                    <div className="font-bold text-white">Automatic Quality Protection</div>
                                    <p>
                                        Every render is checked automatically by Vision QA and repaired silently with your Slot 2–5 close-ups whenever a hardware slip is spotted.
                                    </p>
                                </div>
                            </div>
                        )}

                        {step === 4 && (
                            <div className="space-y-3 text-xs text-gray-300">
                                <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 space-y-1.5">
                                    <div className="font-bold text-white">Calibration Guarantee</div>
                                    <p>
                                        Pick the benchmark staircase most similar to your typical job (e.g., Exterior Wood Deck for side-mount cable, Interior Hardwood for direct-tread iron).
                                    </p>
                                </div>
                                <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 space-y-1.5">
                                    <div className="font-bold text-white">Need Help Polishing?</div>
                                    <p>
                                        You can switch steps to tweak photos or specs anytime before publishing, or click <strong>Request Free Admin Review</strong> if a tricky custom scroll needs hands-on help.
                                    </p>
                                </div>
                            </div>
                        )}
                    </aside>
                </div>

                {/* Bottom Footer Navigation */}
                <div className="px-5 py-3.5 border-t border-white/10 bg-[#121215] flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => {
                            if (step > 1) setStep((step - 1) as 1 | 2 | 3 | 4);
                            else onClose();
                        }}
                        className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-gray-200 flex items-center gap-1.5"
                    >
                        <ArrowLeft size={14} />
                        {step === 1 ? 'Cancel' : 'Back'}
                    </button>

                    <div className="flex items-center gap-2.5">
                        {step === 1 && (
                            <button
                                type="button"
                                disabled={!name.trim()}
                                onClick={() => setStep(2)}
                                className="px-5 py-2 rounded-lg bg-[var(--primary)] text-black text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-40"
                            >
                                Next: Upload 5+ Photos <ArrowRight size={14} />
                            </button>
                        )}
                        {step === 2 && (
                            <button
                                type="button"
                                disabled={!isStep2Valid}
                                onClick={handleGoStep3}
                                className="px-5 py-2 rounded-lg bg-[var(--primary)] text-black text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-40"
                            >
                                Next: Review Fab Spec <ArrowRight size={14} />
                            </button>
                        )}
                        {step === 3 && (
                            <button
                                type="button"
                                onClick={() => setStep(4)}
                                className="px-5 py-2 rounded-lg bg-[var(--primary)] text-black text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                            >
                                Next: Test & Calibrate <ArrowRight size={14} />
                            </button>
                        )}
                        {(step === 3 || step === 4) && (
                            <button
                                type="button"
                                disabled={saving || !isStep2Valid || !name.trim()}
                                onClick={() => void handleSaveStyle()}
                                className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-40"
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                {isUpgradeMode ? 'Save Upgraded Style' : 'Publish Style'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Tap-to-Open Photo Example Pop-Up Guide */}
            {helpPopupSlot && (
                <div
                    className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setHelpPopupSlot(null)}
                >
                    <div
                        className="bg-[#111] border border-white/15 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-white">
                                Slot {helpPopupSlot.slotNumber}: {isWallHandrail && helpPopupSlot.wallHandrailTitle ? helpPopupSlot.wallHandrailTitle : helpPopupSlot.title}
                            </h4>
                            <button
                                type="button"
                                onClick={() => setHelpPopupSlot(null)}
                                className="text-gray-400 hover:text-white"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <SlotCoachingSvg slotId={helpPopupSlot.id} isWall={isWallHandrail} />

                        <p className="text-xs text-gray-300">
                            {isWallHandrail && helpPopupSlot.wallHandrailShortInstruction
                                ? helpPopupSlot.wallHandrailShortInstruction
                                : helpPopupSlot.shortInstruction}
                        </p>

                        <div className="space-y-2 text-xs">
                            <div className="font-mono text-[11px] uppercase text-emerald-400">Good Framing Checklist</div>
                            {helpPopupSlot.goodTips.map((g, i) => (
                                <div key={i} className="flex items-start gap-2 text-gray-200">
                                    <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                                    <span>{g}</span>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2 text-xs pt-2 border-t border-white/10">
                            <div className="font-mono text-[11px] uppercase text-amber-400">Common Mistakes to Avoid</div>
                            {helpPopupSlot.avoidTips.map((b, i) => (
                                <div key={i} className="flex items-start gap-2 text-gray-400">
                                    <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                                    <span>{b}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() => setHelpPopupSlot(null)}
                            className="w-full py-2 rounded-lg bg-[var(--primary)] text-black font-bold text-xs uppercase"
                        >
                            Got It
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
