export interface Lead {
    id: string;
    email: string;
    customer_name: string;
    status: 'New' | 'Contacted' | 'Closed';
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
}
