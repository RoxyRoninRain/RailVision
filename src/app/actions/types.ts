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

export interface PortfolioItem {
    id: string;
    name: string;
    description: string;
    image_url: string;
    tenant_id: string;
    created_at?: string;
    is_active?: boolean;
    style_metadata?: any;
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
}

export interface StyleMetadata {
    second_pass?: SecondPassConfig;
    post_mount?: 'top' | 'side';
    [key: string]: any;
}

export const SECOND_PASS_ISSUES = [
    {
        id: 'reducers',
        label: 'Clean Post Welds (No Reducers/Stems)',
        description: 'Eliminate standoff pins, stems, and reducers; weld posts flush to handrail.',
        prompt: 'POST-TO-RAIL FLUSH WELDS: Remove any standoff pins, stems, or adapter collars between the top of each post and the underside of the handrail. Extend each post upward so it fuses directly and seamlessly into the handrail with a solid flush weld.'
    },
    {
        id: 'shoe_rail',
        label: 'Bottom Shoe Rail Integrity',
        description: 'Ensure spindles terminate into shoe rail without ghosting into steps.',
        prompt: 'BOTTOM SHOE RAIL INTEGRITY: Ensure all vertical spindles/infill terminate cleanly and solidly into the continuous bottom shoe rail. Spindles must NEVER pass through or ghost beneath the shoe rail.'
    },
    {
        id: 'side_mount',
        label: 'Direct 2-Bolt Side Mount (No Plates)',
        description: 'Ensure posts mount directly to outer fascia with 2 through-bolts, strictly no mounting plates.',
        prompt: 'DIRECT 2-BOLT SIDE MOUNT (STRICTLY NO PLATES): Ensure every side-mount post attaches directly flat against the outer stair stringer or deck fascia face using 2 through-bolts (vertically stacked) passing straight through the post body. Eliminate and remove all mounting plates, bracket flanges, standoff collars, and external saddles. Posts must sit flush against the wood face with only the 2 bolt heads visible.'
    },
    {
        id: 'top_mount',
        label: 'Top / Surface Mount Base Plates',
        description: 'Ensure posts mount to the top surface of stair treads/floor with base plates.',
        prompt: 'TOP / SURFACE MOUNT BASE PLATES: Ensure every post base is anchored solidly onto the top horizontal surface of the stair treads or landing floor using surface-mounted base plates or flange shoes. Posts must stand upright directly on the steps, not on the side fascia.'
    }
] as const;

