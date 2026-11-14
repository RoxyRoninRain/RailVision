export interface Lead {
    id: string;
    email: string;
    customer_name: string;
    status: 'New' | 'Pending' | 'Contacted' | 'Sold' | 'Backed Out' | 'On Hold' | 'Closed';
    created_at: string;
    style_id?: string;
    style_name?: string; // joined
    generated_design_url?: string;
    estimate_json?: any;
    organization_id?: string;
    attachments?: string[];
}

export interface Profile {
    id: string;
    email: string;
    shop_name: string | null;
    subscription_status: string;
    logo_url?: string | null;
    phone?: string | null;
    address?: string | null;
    primary_color?: string | null;
    tool_background_color?: string | null;
    logo_size?: number | null;
    watermark_logo_url?: string | null;
    website?: string | null;
    address_zip?: string | null;
    travel_settings?: any;
    confirmation_email_body?: string | null;
    // Metered Pricing Fields
    tier_name?: string;
    enable_overdrive?: boolean;
    pending_overage_balance?: number;
    max_monthly_spend?: number | null;
    current_usage?: number;
}

export type StyleSlotId =
    | 'hero_run'
    | 'post_top_joint'
    | 'post_mount_base'
    | 'infill_bottom'
    | 'end_return'
    | 'finish_macro'
    | 'extra_context';

export interface StyleSlotDefinition {
    id: StyleSlotId;
    slotNumber: number;
    title: string;
    wallHandrailTitle?: string;
    required: boolean;
    maxCount: number;
    shortInstruction: string;
    wallHandrailShortInstruction?: string;
    goodTips: string[];
    avoidTips: string[];
    aiValidationRule: string;
}

export const STYLE_PHOTO_SLOTS: readonly StyleSlotDefinition[] = [
    {
        id: 'hero_run',
        slotNumber: 1,
        title: 'Hero Full-Run Shot',
        required: true,
        maxCount: 1,
        shortInstruction: 'Wide 3/4 angle showing the full railing run, slope, and proportions.',
        goodTips: [
            'Stand 6–10 ft back at a 35–45° angle showing top rail, infill, and posts together',
            'Shoot in clean, even daylight or bright interior lighting',
            'Include bottom newel post up through the upper landing turn',
        ],
        avoidTips: [
            'Blurry phone thumbnails or screenshots with UI chrome',
            'Heavy shadows or cluttered tarps/buckets blocking the bottom rail',
            'Tight crops that cut off the top rail or bottom mount',
        ],
        aiValidationRule: 'Full railing run visible in perspective showing overall system silhouette and finish.',
    },
    {
        id: 'post_top_joint',
        slotNumber: 2,
        title: 'Post-to-Top-Rail Joint Close-Up',
        wallHandrailTitle: 'Wall Bracket-to-Rail Joint Close-Up',
        required: true,
        maxCount: 1,
        shortInstruction: 'Close-up (1–2 ft away) of where the vertical post meets the underside of the top handrail.',
        wallHandrailShortInstruction: 'Close-up of where the wall bracket arm connects to the underside of the handrail.',
        goodTips: [
            'Fill 70%+ of the frame with the exact junction between post and top rail',
            'Make it crystal clear whether it is a seamless direct weld or a stem reducer collar',
            'Ensure crisp focus on metal texture and weld bead / bevel',
        ],
        avoidTips: [
            'Standing more than 4 ft away so the joint cannot be inspected',
            'Heavy lens flare or silhouette backlighting hiding the weld/collar',
        ],
        aiValidationRule: 'Close-up macro/mid shot of post-to-top-rail junction or bracket-to-rail saddle.',
    },
    {
        id: 'post_mount_base',
        slotNumber: 3,
        title: 'Post Base / Stair Mount Close-Up',
        wallHandrailTitle: 'Wall Bracket Rosette / Anchor Close-Up',
        required: true,
        maxCount: 1,
        shortInstruction: 'Close-up of how the post bolts onto the stair tread (top flange) OR outer fascia (side bolts).',
        wallHandrailShortInstruction: 'Close-up of the round/square wall escutcheon plate and fasteners mounted to the wall.',
        goodTips: [
            'Show bolt heads clearly (e.g., 2 vertical fascia bolts vs 4-bolt base shoe with cover)',
            'Show whether base plates sit flat on tread or bolt directly flat to the stringer fascia',
        ],
        avoidTips: [
            'Leaves, drop cloths, or tape covering the post base hardware',
            'Shot from directly above where flange height cannot be seen',
        ],
        aiValidationRule: 'Close-up clearly showing post bottom mount hardware (flange shoe, fascia bolts, or wall escutcheon).',
    },
    {
        id: 'infill_bottom',
        slotNumber: 4,
        title: 'Infill & Bottom Termination Close-Up',
        wallHandrailTitle: 'Handrail Profile & Side Clearance Close-Up',
        required: true,
        maxCount: 1,
        shortInstruction: 'Close-up of pickets/cables/glass AND how they terminate at the bottom (shoe rail vs direct tread).',
        wallHandrailShortInstruction: 'Angled close-up looking down the wall-mounted rail profile showing standoff spacing from the wall.',
        goodTips: [
            'Show infill bar/cable thickness, spacing, and cable fittings/turnbuckles if any',
            'Clearly capture the bottom shoe channel gap OR pickets going straight into wood/concrete',
        ],
        avoidTips: [
            'Straight-on flat views where bottom clearance above treads is invisible',
            'Extreme motion blur on cable strands or glass clamps',
        ],
        aiValidationRule: 'Close-up showing infill pattern geometry and how infill terminates at the bottom rail or treads.',
    },
    {
        id: 'end_return',
        slotNumber: 5,
        title: 'End / Corner / Wall Return Close-Up',
        required: true,
        maxCount: 1,
        shortInstruction: 'Close-up of how the handrail terminates at the end of a run (90° wall return, cap, volute, or miter corner).',
        goodTips: [
            'Capture the handrail end cap, lamb\'s tongue, or 90-degree mitered wall return',
            'Keep the background clean so the cap silhouette is sharp',
        ],
        avoidTips: [
            'Cropping off the final 6 inches of the handrail end',
        ],
        aiValidationRule: 'Close-up showing handrail end termination, cap style, corner transition, or wall return.',
    },
    {
        id: 'finish_macro',
        slotNumber: 6,
        title: 'Finish / Material Macro (Optional)',
        required: false,
        maxCount: 1,
        shortInstruction: 'Macro texture shot showing powder-coat sheen, brushed stainless grain, wood species, or custom patinas.',
        goodTips: [
            'Soft indirect daylight showing true sheen (matte vs satin vs gloss)',
        ],
        avoidTips: [
            'Harsh direct flash blowing out metal sheen into pure white',
        ],
        aiValidationRule: 'Macro texture photo showing powder coat sheen, metal grain, or wood stain.',
    },
    {
        id: 'extra_context',
        slotNumber: 7,
        title: 'Extra Context Angles (Optional, up to 2)',
        required: false,
        maxCount: 2,
        shortInstruction: 'Interior/exterior sibling install of this exact same railing design (turns, landings, or deck transitions).',
        goodTips: [
            'Only upload photos of the EXACT same railing profile & finish',
            'Great for showing how corners or level balcony transitions look',
        ],
        avoidTips: [
            'Do NOT mix two different railing styles or colors into one style pack',
        ],
        aiValidationRule: 'Additional angle or level-balcony view of the exact same railing system.',
    },
] as const;

export const MIN_WIZARD_REQUIRED_SLOTS = 5;
export const MAX_WIZARD_TOTAL_PHOTOS = 8;
export const MAX_FREE_CALIBRATION_RENDERS = 3;

export type FabricationCategory = 'stair_railing' | 'wall_handrail' | 'guardrail' | 'hybrid';
export type FabricationPostMount = 'top' | 'side' | 'wall' | 'mixed';
export type FabricationJointType = 'direct_flush_weld' | 'stem_reducer' | 'bracket_saddle' | 'wall_bracket';
export type FabricationInfillType =
    | 'vertical_pickets'
    | 'horizontal_bars'
    | 'horizontal_cable'
    | 'tempered_glass'
    | 'mesh_panel'
    | 'custom_scroll'
    | 'none_wall_only';

export interface FabricationSpec {
    category: FabricationCategory;
    material: string;
    finish: string;
    top_rail_profile: string;
    post_profile: string;
    post_mount_type: FabricationPostMount;
    bolt_pattern: string;
    post_to_rail_joint: FabricationJointType;
    infill_type: FabricationInfillType;
    infill_profile_and_spacing: string;
    has_bottom_rail: boolean;
    bottom_termination: string;
    handrail_return: string;
    distinctive_features: string[];
    conflicts_detected?: string[];
    confidence_notes?: string;
}

export interface SceneRouterAnalysis {
    scene_category: 'interior_stairs' | 'exterior_deck_porch' | 'concrete_steps' | 'balcony_loft' | 'commercial_ramp';
    stair_geometry: string;
    preferred_rake_direction: 'left_to_right_ascending' | 'right_to_left_ascending' | 'flat_run' | 'mixed';
    existing_railing_present: boolean;
    existing_railing_description: string;
    demolition_required: boolean;
    mounting_surface: 'wood_fascia_stringer' | 'wood_treads' | 'carpeted_treads' | 'concrete_masonry' | 'metal_stringer' | 'drywall_wall';
    recommended_mount_note: string;
    lighting_direction: string;
    camera_elevation: string;
    occlusions_to_preserve: string[];
    structural_anchors: string[];
}

export interface VisionQaResult {
    passed: boolean;
    confidence: number;
    defects_found: string[];
    suggested_targets: string[];
    surgical_fix_instructions: string;
    background_preservation_ok: boolean;
    railing_fidelity_score: number;
}

export interface StyleLabeledSlotEntry {
    slot_id: StyleSlotId;
    url: string;
    validated?: boolean;
    validation_note?: string;
}

export interface PortfolioItem {
    id: string;
    name: string;
    description: string;
    image_url: string;
    tenant_id: string;
    created_at?: string;
    is_active?: boolean;
    style_metadata?: StyleMetadata | null;
    reference_images?: string[];
    price_per_ft_min?: number;
    price_per_ft_max?: number;
    has_bottom_rail?: boolean;
    has_reducers?: boolean | null;
    post_mount?: 'top' | 'side' | null;
}

export interface SecondPassConfig {
    enabled: boolean;
    targets: string[];
    custom_prompt?: string;
    detail_images?: Record<string, string>;
}

export interface StyleMetadata {
    second_pass?: SecondPassConfig;
    post_mount?: 'top' | 'side';
    wizard_version?: number;
    category?: FabricationCategory;
    labeled_slots?: Partial<Record<StyleSlotId, string[]>>;
    fabrication_spec?: FabricationSpec;
    canonical_image_url?: string;
    use_canonical_cutout?: boolean;
    free_calibration_used?: number;
    calibration_approved?: boolean;
    admin_review_requested?: boolean;
    admin_review_notes?: string;
    [key: string]: any;
}

export const SECOND_PASS_ISSUES = [
    {
        id: 'reducers',
        label: 'Rail Connection / Flush Welds',
        description: 'Eliminate standoff pins, stems, and reducers; weld posts flush to handrail.',
        prompt: 'POST-TO-RAIL FLUSH WELDS: Remove any standoff pins, stems, or adapter collars between the top of each post and the underside of the handrail. Extend each post upward so it fuses directly and seamlessly into the handrail with a solid flush weld.',
        uploadLabel: 'Rail Connection',
        uploadHint: 'Upload a close-up photo showing how the post meets the top handrail.'
    },
    {
        id: 'side_mount',
        label: 'Direct 2-Bolt Side Mount (No Plates)',
        description: 'Mount posts directly to outer fascia with 2 through-bolts, strictly no mounting plates.',
        prompt: 'DIRECT 2-BOLT SIDE MOUNT (STRICTLY NO PLATES): Ensure every side-mount post attaches directly flat against the outer stair stringer or deck fascia face using 2 through-bolts (vertically stacked) passing straight through the post body. Eliminate and remove all mounting plates, bracket flanges, standoff collars, and external saddles. Posts must sit flush against the wood face with only the 2 bolt heads visible.',
        uploadLabel: 'Side Mount Detail',
        uploadHint: 'Upload a close-up photo showing the 2 bolts through the post into the stringer/fascia.'
    },
    {
        id: 'top_mount',
        label: 'Top / Surface Mount Base Plates',
        description: 'Ensure posts mount to the top surface of stair treads/floor with base plates.',
        prompt: 'TOP / SURFACE MOUNT BASE PLATES: Ensure every post base is anchored solidly onto the top horizontal surface of the stair treads or landing floor using surface-mounted base plates or flange shoes. Posts must stand upright directly on the steps, not on the side fascia.',
        uploadLabel: 'Top Mount Detail',
        uploadHint: 'Upload a close-up photo showing the surface base plate mounted to the tread/floor.'
    },
    {
        id: 'shoe_rail',
        label: 'Bottom Shoe Rail Integrity',
        description: 'Ensure spindles terminate into shoe rail without ghosting into steps.',
        prompt: 'BOTTOM SHOE RAIL INTEGRITY: Ensure all vertical spindles/infill terminate cleanly and solidly into the continuous bottom shoe rail. Spindles must NEVER pass through or ghost beneath the shoe rail.',
        uploadLabel: 'Shoe Rail Detail',
        uploadHint: 'Upload a close-up photo showing the bottom shoe rail and spindle terminations.'
    },
    {
        id: 'direct_mount',
        label: 'Direct Tread Mount (No Bottom Rail)',
        description: 'Remove any unwanted lower shoe rail so spindles/posts anchor directly into treads.',
        prompt: 'DIRECT TREAD MOUNT (NO BOTTOM SHOE RAIL): Remove any lower horizontal shoe rail or bottom channel hovering above the stair nosings. Extend every vertical baluster/spindle cleanly down to anchor directly into its individual stair tread surface, restoring clean tread wood/carpet between spindles.',
        uploadLabel: 'Direct Tread Mount Detail',
        uploadHint: 'Upload a close-up photo showing balusters anchoring directly into the stair tread.'
    },
    {
        id: 'reducer_fittings',
        label: 'Post-Top Reducer Collars',
        description: 'Preserve and refine stem reducer / transition collars where posts meet the top rail.',
        prompt: 'POST-TOP REDUCER FITTINGS: Ensure each structural post connects to the underside of the top handrail via clean, uniform post-top stem reducers / transition adapter collars matching the reference hardware.',
        uploadLabel: 'Reducer Fitting Detail',
        uploadHint: 'Upload a close-up photo showing the post-top stem reducer collar meeting the handrail.'
    }
] as const;

