import { z } from 'zod';

// Profile Update Schema
export const profileSchema = z.object({
    shop_name: z.string().min(1, "Shop name is required").optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    primary_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color hex").optional(),
    tool_background_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color hex").optional(),
    logo_size: z.number().min(10).max(500).optional(),
    logo_url: z.string().url().optional(),
    watermark_logo_url: z.string().url().optional(),
    website: z.string().url().optional().or(z.literal('')),
    address_zip: z.string().optional(),
    confirmation_email_body: z.string().optional(),
    travel_settings: z.any().optional(), // Could be stricter if we knew shape
    enable_overdrive: z.boolean().optional(),
    max_monthly_spend: z.number().positive().optional().nullable(),
});

// Generation/AI Schema
export const generationSchema = z.object({
    style: z.string().min(1, "Style is required"),
    // Files are harder to validate directly with Zod on FormData without transform, 
    // but we can validate metadata identifiers
    styleId: z.string().uuid().optional(),
    style_url: z.string().url().optional(),
    organization_id: z.string().uuid().optional(),
});
