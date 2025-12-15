'use server';

import { InputSanitizer } from '@/components/security/InputSanitizer';


import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateDesignWithNanoBanana } from '@/lib/vertex';
import { PRICING_TIERS, BOOSTER_PACKS, TierId, BoosterId } from '@/config/pricing';

// --- CREDIT SYSTEM LOGIC ---

async function deductCredit(supabase: any, userId: string): Promise<{ success: boolean; error?: string }> {
    // 1. Fetch Profile
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error || !profile) return { success: false, error: 'Profile not found' };

    // 2. Logic: Monthly -> Rollover -> Booster
    let updates: any = {};

    if ((profile.credits_monthly || 0) > 0) {
        updates.credits_monthly = profile.credits_monthly - 1;
        // Also track usage for analytics if needed, but we just decrement balance here
    } else if (profile.tier === 'showroom' && (profile.credits_rollover || 0) > 0) {
        updates.credits_rollover = profile.credits_rollover - 1;
    } else if ((profile.credits_booster || 0) > 0) {
        updates.credits_booster = profile.credits_booster - 1;
    } else {
        // 3. Auto-Boost Logic
        if (profile.auto_boost_enabled && profile.auto_boost_pack) {
            console.log(`[Credits] Auto-boosting with pack: ${profile.auto_boost_pack}`);
            const pack = BOOSTER_PACKS[profile.auto_boost_pack as keyof typeof BOOSTER_PACKS]; // e.g., 'REFILL'

            // Just for safety if pack key is lowercase in DB but UPPER in config or vice versa. 
            // We defined keys as REFILL, PROJECT in config constant, but ids as 'refill', 'project'.
            // Let's match by ID.
            const packDetails = Object.values(BOOSTER_PACKS).find(p => p.id === profile.auto_boost_pack);

            if (packDetails) {
                // Charge Card (Mock)
                console.log(`[Billing] Charging user ${userId} $${packDetails.price} for Auto-Boost`);

                // Add credits immediately (current booster balance + new pack - 1 for this gen)
                updates.credits_booster = (profile.credits_booster || 0) + packDetails.credits - 1;
            } else {
                return { success: false, error: 'Insufficient credits. Auto-boost failed (Invalid Pack).' };
            }
        } else {
            return { success: false, error: 'Insufficient credits. Please upgrade or buy a booster pack.' };
        }
    }

    // 4. Commit Update
    const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

    if (updateError) return { success: false, error: updateError.message };

    return { success: true };
}

export async function purchaseBooster(packId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    const pack = Object.values(BOOSTER_PACKS).find(p => p.id === packId);
    if (!pack) return { error: 'Invalid Booster Pack' };

    // Mock Billing
    console.log(`[Billing] User ${user.id} bought ${pack.name} for $${pack.price}`);

    // Fetch current booster balance
    const { data: profile } = await supabase.from('profiles').select('credits_booster').eq('id', user.id).single();
    const current = profile?.credits_booster || 0;

    const { error } = await supabase
        .from('profiles')
        .update({ credits_booster: current + pack.credits })
        .eq('id', user.id);

    if (error) return { error: error.message };
    return { success: true };
}

export async function updateTier(tierId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    const tier = Object.values(PRICING_TIERS).find(t => t.id === tierId);
    if (!tier) return { error: 'Invalid Tier' };

    // Mock Billing / Subscription Switch
    console.log(`[Billing] User ${user.id} switched to ${tier.name} ($${tier.price}/mo)`);

    // Reset Monthly Credits to new tier allowance? 
    // Usually prorated, but for simplicity: Set allowance immediately or wait for cycle?
    // User Requirement: "Monthly credits reset to X on billing cycle".
    // If upgrading mid-month, typically you get new features immediately. Credits? 
    // Let's give them the full allowance for now as a "fresh start".

    // Also reset rollover if moving OFF Showroom? 
    // "Rollover: FALSE" for others. DB column stays, we just stop consuming it?
    // User logic: "Logic: Unused monthly credits carry over." logic is tier specific.

    const { error } = await supabase
        .from('profiles')
        .update({
            tier: tier.id,
            credits_monthly: tier.monthlyCredits
        })
        .eq('id', user.id);

    if (error) return { error: error.message };
    return { success: true };
}

export async function toggleAutoBoost(enabled: boolean, packId?: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    const updates: any = { auto_boost_enabled: enabled };
    if (packId) updates.auto_boost_pack = packId;

    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) return { error: error.message };
    return { success: true };
}


// TYPES
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
    // Credit System
    tier?: string;
    credits_monthly?: number;
    credits_rollover?: number;
    credits_booster?: number;
    auto_boost_enabled?: boolean;
    auto_boost_pack?: string;
}

export async function generateDesign(formData: FormData) {
    console.log('[DEBUG] generateDesign (NANO BANANA MODE) called');
    const file = formData.get('image') as File;
    const style = formData.get('style') as string;
    const styleFile = formData.get('style_image') as File;

    if (!file || (!style && !styleFile)) {
        return { error: 'Missing image or style reference.' };
    }

    // Server-side validation
    const validation = InputSanitizer.validate(file);
    if (!validation.valid) {
        return { error: validation.error };
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // 0. CHECK CREDITS
        if (user) {
            const { success, error } = await deductCredit(supabase, user.id);
            if (!success) {
                return { error: error || 'Insufficient credits' };
            }
        } else {
            // For public/demo users (not logged in fabricator), we might skip or have a rate limit.
            // But 'generateDesign' is the fabricator action.
            // If this is the public widget, the user is NOT logged in as the fabricator.
            // The fabricator ID is passed via hidden field or context? 
            // "white-label Design Studio directly on your website". 
            // Frame src="/demo?org=UUID".
            // The 'formData' should contain 'organization_id' if coming from public widget.
            // Let's check formData for organization_id.
            // User's implementation of Public Widget likely hits an API route or this action.
            // If actions.ts is used by client component, we need to know WHO's credits to burn.

            // Check if 'organization_id' is in formData (passed from public widget)
            const orgId = formData.get('organization_id') as string;
            if (orgId) {
                console.log(`[Credits] Public generation for Org: ${orgId}`);
                const { success, error } = await deductCredit(supabase, orgId);
                if (!success) return { error: 'This visualization tool has reached its usage limit for the month. Please contact the shop owner.' };
            } else {
                console.warn('[Credits] No user or orgId found. Allowing free gen (or restrict?)');
                // For now, allow but log warning. Or strict block? 
                // "The Problem: Fabricators ... on their own website". 
            }
        }

        let styleInput: string | { base64StyleImage: string } = style;

        if (styleFile) {
            const styleBuffer = Buffer.from(await styleFile.arrayBuffer());
            const styleBase64 = styleBuffer.toString('base64');
            styleInput = { base64StyleImage: styleBase64 };
            console.log('[DEBUG] Using CUSTOM Style Image for Nano Banana fusion');
        } else {
            // Priority 2: Check for style_url (Preset or DB-loaded style)
            const styleUrl = formData.get('style_url') as string;

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
                        styleInput = { base64StyleImage: styleBase64 };
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

        // 1. Fetch dynamic prompt configuration (Restored)
        const { getActiveSystemPrompt } = await import('@/app/admin/actions');
        const promptData = await getActiveSystemPrompt();

        let promptConfig = undefined;
        if (promptData) {
            promptConfig = {
                systemInstruction: promptData.system_instruction,
                userTemplate: promptData.user_template
            };
            console.log('[DEBUG] Using active dynamic prompt from DB:', promptData.key);
        } else {
            console.log('[DEBUG] Using default fallback prompt (DB fetch failed or empty)');
        }

        const result = await generateDesignWithNanoBanana(base64Image, styleInput, promptConfig);

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

                await supabase.from('generations').insert({
                    organization_id: user ? user.id : null,
                    image_url: result.image.startsWith('data:') ? 'Base64 Image Data' : result.image,
                    prompt_used: promptConfig ? 'Dynamic Prompt' : 'Default Prompt',
                    style_id: style,
                    ip_address: ip,
                    user_agent: userAgent,
                    // COST TRACKING
                    model_id: 'gemini-3.0-pro-image-preview',
                    input_tokens: result.usage?.inputTokens || 0,
                    output_tokens: result.usage?.outputTokens || 0
                });
                console.log('[DEBUG] Generation tracked in DB with IP:', ip);
            } catch (err) {
                console.warn('[Tracking] Failed to log generation:', err);
            }
            // --- TRACKING END ---

            return { success: true, data: result.image };
        } else {
            throw new Error(result.error || 'Unknown Nano Banana error');
        }

    } catch (error: any) {
        console.error('[ERROR] Generation Failed:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        // Fallback for demo/dev purposes if API fails (e.g. Rate Limit or 404)
        console.warn('Returning fallback image due to generation failure.');
        return {
            success: true,
            data: '/styles/modern.png', // Fallback to a valid existing image
            isFallback: true
        };
        // return { error: 'Failed to generate image. ' + (error.message || 'Unknown error') };
    }
}

export async function submitLead(formData: FormData) {
    const supabase = await createClient(); // Use server client

    // Extract Form Data
    const email = formData.get('email') as string;
    const customer_name = formData.get('customer_name') as string || 'Guest';
    const styleName = formData.get('style_name') as string;
    const generatedUrl = formData.get('generated_design_url') as string;
    const orgId = formData.get('organization_id') as string;
    const phone = formData.get('phone') as string;
    const message = formData.get('message') as string;

    if (!email || !email.includes('@')) {
        return { success: false, error: 'Invalid email' };
    }

    // Look up style_id if possible
    let style_id = null;
    if (styleName) {
        const { data: style } = await supabase.from('portfolio').select('id').eq('name', styleName).single();
        if (style) style_id = style.id;
    }

    // Construct Estimate JSON (storing prompt details + contact info)
    const estimate_json = {
        phone,
        message,
        requested_at: new Date().toISOString(),
        // Stub pricing data (can be dynamic later)
        base_price: 1500,
        travel_fee: 200,
        addons: [{ name: 'LED Lighting', price: 300 }],
        total: 2000
    };

    // Prepare DB Payload
    const payload: any = {
        email,
        customer_name,
        style_name: styleName,
        style_id,
        generated_design_url: generatedUrl,
        estimate_json,
        status: 'New',
        created_at: new Date().toISOString()
    };

    if (orgId) {
        payload.organization_id = orgId;
    }

    // Insert
    const { error } = await supabase
        .from('leads')
        .insert([payload]);

    if (error) {
        console.error('Supabase Error:', error);
        return { success: false, error: 'Database error' };
    }

    // Stub for Email Notification
    console.log(`[Notification] New Quote Request for Tenant ${orgId || 'Generic'}: ${customer_name} (${email})`);

    return { success: true };
}

export async function getTenantProfile(organizationId: string) {
    if (!organizationId) return null;

    const supabase = await createClient();

    // Public fetch of branding details
    const { data, error } = await supabase
        .from('profiles')
        .select(`
            shop_name, logo_url, phonenumber:phone, address, 
            primary_color, tool_background_color, logo_size, 
            watermark_logo_url, website, subscription_status,
            tier, credits_monthly, credits_rollover, credits_booster, 
            auto_boost_enabled, auto_boost_pack
        `)
        .eq('id', organizationId)
        .single();

    if (error) {
        console.error('Fetch Tenant Profile Error:', error);
        return null;
    }

    return data;
}

// Admin Action to "Invite" (Mock for now, or actual if we had Service Key)
// Admin Action to Invite Tenant
export async function inviteTenant(email: string) {
    // Import from the new server-only file
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const adminSupabase = createAdminClient();

    if (!adminSupabase) {
        console.warn('SUPABASE_SERVICE_ROLE_KEY missing. Falling back to mock.');
        // Add debug info to message
        const keyLen = process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.length : 0;
        console.log(`Debug Check: Env Var Length = ${keyLen}`);
        return { success: true, message: `[SIMULATION] Email sent to ${email} (Key missing, Len: ${keyLen})`, isSimulation: true, inviteLink: undefined };
    }


    console.log('[ADMIN] Attempting invite via SMTP for:', email);

    // 1. Try sending actual email
    const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: 'https://railify.app/auth/callback?next=/onboarding'
    });

    if (inviteError) {
        console.error('[ADMIN] SMTP Invite Failed:', JSON.stringify(inviteError));

        // SPECIAL HANDLING: User already exists
        if (inviteError.message.includes('already registered') || inviteError.status === 422) {
            // Try generating a link for existing user? Or just report it.
            // Usually for existing users you just want to let them know.
            return {
                success: false,
                error: `User already exists. (${inviteError.message})`,
                fullError: inviteError
            };
        }

        // 2. FALLBACK: Generate Manual Link if SMTP fails (e.g. Rate Limit, Config Error)
        console.warn('[ADMIN] Falling back to Manual Link generation due to:', inviteError.message);

        const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
            type: 'invite',
            email: email,
            options: {
                redirectTo: 'https://railify.app/auth/callback?next=/onboarding'
            }
        });

        if (linkError) {
            console.error('[ADMIN] Manual Link Generation Failed:', linkError);
            return {
                success: false,
                error: `Detailed Error: ${inviteError.message} | Link Gen Error: ${linkError.message}`,
                fullError: { invite: inviteError, link: linkError }
            };
        }

        return {
            success: true,
            message: `Email Service Failed (${inviteError.name}: ${inviteError.message || inviteError.status}). Manual Link Generated.`,
            isSimulation: false,
            inviteLink: linkData.properties?.action_link
        };
    }

    console.log('[ADMIN] Invite sent to:', email);
    return {
        success: true,
        message: `Invitation email sent to ${email} successfully.`,
        isSimulation: false,
        inviteLink: undefined
    };
}

// --- Porfolio Actions ---

export interface PortfolioItem {
    id: string;
    name: string;
    description: string;
    image_url: string;
    tenant_id: string;
    created_at?: string;
    is_active?: boolean;
    style_metadata?: any;
}

export async function createStyle(formData: FormData) {
    const supabase = await createClient();

    // 1. Validate File
    const file = formData.get('file') as File;
    if (!file) return { error: 'No file uploaded' };

    // STRICT SERVER-SIDE VALIDATION
    // 4.5MB Limit (slightly under 5MB to be safe)
    const MAX_SIZE = 4.5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        return { error: `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Max allowed is 4.5MB.` };
    }

    const name = formData.get('name') as string;
    const desc = formData.get('description') as string;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    // 2. Upload to Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
        .from('portfolio')
        .upload(fileName, file);

    if (uploadError) {
        console.error('Upload Error:', uploadError);
        return { error: 'Upload failed: ' + uploadError.message };
    }

    // 3. Get Public URL
    const { data: publicUrlData } = supabase.storage
        .from('portfolio')
        .getPublicUrl(fileName);

    // 4. Insert into DB
    // 4. Insert into DB
    const { data, error: dbError } = await supabase
        .from('portfolio')
        .insert({
            name,
            description: desc,
            image_url: publicUrlData.publicUrl,
            tenant_id: user.id,
            is_active: true
        })
        .select()
        .single();

    if (dbError) {
        console.error('DB Insert Error:', dbError);
        // Optional: Cleanup file if DB fails
        return { error: 'Database error: ' + dbError.message };
    }

    // 5. Done
    return { success: true };
}

export async function updateStyleStatus(id: string, isActive: boolean) {
    const supabase = await createClient();
    const { error } = await supabase
        .from('portfolio')
        .update({ is_active: isActive })
        .eq('id', id);

    if (error) return { error: error.message };
    return { success: true };
}

export async function seedDefaultStyles() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    // Check if user already has styles
    const { count } = await supabase
        .from('portfolio')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', user.id);

    if (count && count > 0) return { success: true, message: 'Styles already exist' };

    // Default Styles
    const defaults = [
        { name: 'Industrial Modern', description: 'Clean lines with raw metal finishes', image_url: '/styles/industrial.png' },
        { name: 'Classic Wrought Iron', description: 'Timeless elegance with ornate details', image_url: '/styles/classic.png' },
        { name: 'Minimalist Glass', description: 'Sleek and transparent for open spaces', image_url: '/styles/minimalist.png' },
        { name: 'Rustic Farmhouse', description: 'Warm wood tones mixed with metal', image_url: '/styles/rustic.png' },
        { name: 'Art Deco', description: 'Bold geometric patterns and luxury', image_url: '/styles/artdeco.png' },
    ];

    const { error } = await supabase
        .from('portfolio')
        .insert(defaults.map(d => ({
            ...d,
            tenant_id: user.id,
            is_active: true
        })));

    if (error) return { error: error.message };
    return { success: true, seeded: true };
}

export async function deleteStyle(styleId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Not authenticated' };

    // Get style to find image path (optional cleanup, but good practice)
    const { data: style } = await supabase
        .from('portfolio')
        .select('image_url')
        .eq('id', styleId)
        .eq('tenant_id', user.id)
        .single();

    if (style) {
        // Extract path from URL if needed, or just delete row.
        // For now, just delete row. Storage cleanup can be a separate cron or trigger.
    }

    const { error } = await supabase
        .from('portfolio')
        .delete()
        .eq('id', styleId)
        .eq('tenant_id', user.id);

    if (error) return { error: error.message };
    return { success: true };
}

// Enhanced fetch for debugging
export async function getTenantStyles(tenantId?: string) {
    const supabase = await createClient();
    let targetTenantId = tenantId;

    if (!targetTenantId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) targetTenantId = user.id;
    }

    if (!targetTenantId) return { data: [], error: 'No tenant ID found' };

    const { data, error } = await supabase
        .from('portfolio')
        .select('*')
        .eq('tenant_id', targetTenantId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Get Tenant Styles Error:', error);
        return { data: [], error: error.message };
    }

    return { data, error: null };
}

export async function getPublicStyles(tenantId: string) {
    const supabase = await createClient(); // Ideally strictly public client or admin client? 
    // Wait, createClient() uses cookies. For public page, we might need no-auth client?
    // Actually, createClient util likely uses standardized client. 
    // But since this is public, we rely on the Anon Key and RLS "Public can view active styles".

    // We need to instantiate a client that Doesn't need auth if the user isn't logged in.
    // Standard createClient() on server actions tries to get cookies.
    // If no cookies, it's anon.

    const { data, error } = await supabase
        .from('portfolio')
        .select('id, name, description, image_url')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Get Public Styles Error:', error);
        return [];
    }

    return data;
}

export async function getStyles(tenantId?: string) {
    // Since getStyles is used in public visualizer, we likely need public access.
    // But createClient() in server actions usually has full access or user context.
    // For public visualizer (unauthenticated visitor), createClient() follows RLS for anon.
    // We need to ensure 'portfolio' table has PUBLIC SELECT policy for tenant_id rows.
    const supabase = await createClient();
    const { data } = await supabase
        .from('portfolio')
        .select('id, name, description, image_url') // Select minimal fields to match 'style' interface
        .eq('tenant_id', tenantId);

    if (data && data.length > 0) {
        // Map to ensure it matches the format
        return data as any[];
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

export async function getOwnerLeads(): Promise<Lead[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    const { data, error } = await supabase
        .from('leads')
        .select(`
      *,
      portfolio (
        name
      )
    `)
        // RLS will enforce organization_id = auth.uid(), but explicitly adding filter is safe
        .eq('organization_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Get Owner Leads Error:', error);
        return [];
    }

    return data.map((lead: any) => ({
        ...lead,
        style_name: lead.portfolio?.name || 'Unknown'
    }));
}

export async function getProfile() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (!data && !error) {
        // If profile doesn't exist but user does (migration timing), create it?
        // Or just return basic info
        return { id: user.id, email: user.email, shop_name: null, subscription_status: 'active' };
    }

    return data;
}

export async function updateProfile(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Not authenticated' };

    const shop_name = formData.get('shop_name') as string;
    const phone = formData.get('phone') as string;
    const address = formData.get('address') as string;
    const primary_color = formData.get('primary_color') as string;
    const tool_background_color = formData.get('tool_background_color') as string;
    const logo_size = formData.get('logo_size') ? parseInt(formData.get('logo_size') as string) : null;
    const logo_url = formData.get('logo_url') as string;
    const watermark_logo_url = formData.get('watermark_logo_url') as string;
    const website = formData.get('website') as string;

    const updates: any = {};
    if (shop_name) updates.shop_name = shop_name;
    if (phone) updates.phone = phone;
    if (address) updates.address = address;
    if (primary_color) updates.primary_color = primary_color;
    if (tool_background_color) updates.tool_background_color = tool_background_color;
    if (logo_size) updates.logo_size = logo_size;
    if (logo_url) updates.logo_url = logo_url;
    if (watermark_logo_url) updates.watermark_logo_url = watermark_logo_url;
    if (website) updates.website = website;

    const upsertData: any = {
        id: user.id,
        email: user.email,
        ...updates,
        updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
        .from('profiles')
        .upsert(upsertData);

    if (error) {
        return { error: error.message };
    }

    return { success: true };
}

export async function uploadLogo(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Not authenticated' };

    const file = formData.get('file') as File;
    if (!file) return { error: 'No file provided' };

    // Validate file
    if (!file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
        return { error: 'File must be an image (PNG, JPG, SVG)' };
    }
    if (file.size > 2 * 1024 * 1024) { // 2MB
        return { error: 'File size must be less than 2MB' };
    }

    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file, {
            upsert: true,
            contentType: file.type
        });

    if (uploadError) {
        return { error: uploadError.message };
    }

    const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);

    // Update profile
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);

    if (updateError) {
        return { error: updateError.message };
    }

    return { success: true, url: publicUrl };
}



export async function getDashboardUrl() {
    console.log('[DEBUG] getDashboardUrl called');
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
        console.error('[DEBUG] getDashboardUrl getUser Error:', error);
    }

    if (!user) {
        console.log('[DEBUG] getDashboardUrl: No user found. Returning /login');
        return '/login';
    }

    console.log('[DEBUG] getDashboardUrl: User found:', user.email);

    // 1. Check if Super Admin
    // In a real app, check a 'roles' table or 'is_admin' column.
    // For now, simple email list check matching getAdminStats()
    const ADMIN_EMAILS = ['admin@railify.com', 'me@railify.com', 'john@railify.com'];
    if (user.email && ADMIN_EMAILS.includes(user.email)) {
        console.log('[DEBUG] Redirecting to Admin Stats');
        return '/admin/stats';
    }

    // 2. Default to Shop Owner Dashboard
    // We could ensure they have a profile here, but for now just redirect
    console.log('[DEBUG] Redirecting to Shop Dashboard');
    return '/dashboard/leads';
}

export async function getAdminStats() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Security Check
    // In real app, check a specific role or table. For now, check email.
    if (!user || !['admin@railify.com', 'me@railify.com'].includes(user.email || '')) {
        // Fallback or empty if not admin
        // But we might want to return empty to avoid leaking info
        // Check constraints: "Ensure /admin is absolutely unreachable by normal users"
        // This action should probably throw or return empty.
        console.warn('Unauthorized admin access attempt', user?.email);
        return [];
    }

    // 2. Use Admin Client to bypass RLS
    const adminSupabase = createAdminClient();

    // If Service Key is missing, we can't bypass RLS.
    // The query below will return 0 rows for other tenants if using standard 'supabase' client.
    const dbClient = adminSupabase || supabase;

    if (!adminSupabase) {
        console.warn('[AdminStats] SUPABASE_SERVICE_ROLE_KEY missing. Admin View restricted by RLS (will likely see 0 tenants).');
    }

    const { data, error } = await dbClient
        .from('leads')
        .select('organization_id, id');

    if (error) {
        console.error('Admin Stats Error:', error);
        return [];
    }

    // 4. Fetch ALL profiles to ensure we show tenants with 0 leads
    const { data: profiles, error: profilesError } = await dbClient
        .from('profiles')
        .select('id, shop_name, email');

    if (profilesError) {
        console.error('Admin Stats Profile Fetch Error:', profilesError);
    }

    // 5. Group leads by organization_id
    const leadCounts: Record<string, number> = {};
    data.forEach((lead: any) => {
        const orgId = lead.organization_id || 'Unknown';
        leadCounts[orgId] = (leadCounts[orgId] || 0) + 1;
    });

    // 6. Merge Profiles with Lead Counts
    // We want to return an entry for every profile, plus any 'Unknown' organzations found in leads
    const allOrgIds = new Set([
        ...(profiles?.map(p => p.id) || []),
        ...Object.keys(leadCounts)
    ]);

    // 7. Get Tenant Generation Counts
    const { data: genData } = await dbClient
        .from('generations')
        .select('organization_id');

    const genCounts: Record<string, number> = {};
    genData?.forEach((g: any) => {
        const org = g.organization_id || 'Unknown';
        genCounts[org] = (genCounts[org] || 0) + 1;
    });

    // 8. Map and Filter
    const stats = Array.from(allOrgIds).map(orgId => {
        const profile = profiles?.find(p => p.id === orgId);
        return {
            organization_id: orgId,
            shop_name: profile?.shop_name || 'Unknown Shop', // New Field
            email: profile?.email || '', // New Field
            count: leadCounts[orgId] || 0,
            generation_count: genCounts[orgId] || 0
        };
    });

    // Filter out Admin Account (User Request)
    return stats.filter(s => s.email !== 'admin@railify.com');
}

export async function updateLeadStatus(leadId: string, status: 'New' | 'Contacted' | 'Closed') {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase
        .from('leads')
        .update({ status })
        .eq('id', leadId)
        .eq('organization_id', user.id); // Ensure ownership

    if (error) {
        console.error('Update Status Error:', error);
        return { success: false, error: 'Database error' };
    }

    return { success: true };
}

// --- Stats Actions ---
export async function getTenantStatsLegacy() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { totalGenerations: 0, topStyle: 'None' };

    const { data, error } = await supabase
        .from('leads')
        .select('style_name');

    if (error || !data) return { totalGenerations: 0, topStyle: 'None' };

    const totalGenerations = data.length;

    // Calculate Top Style
    const styleCounts: Record<string, number> = {};
    data.forEach(l => {
        const s = l.style_name || 'Unknown';
        styleCounts[s] = (styleCounts[s] || 0) + 1;
    });

    const topStyle = Object.entries(styleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

    return { totalGenerations, topStyle };
}

export async function getTenantLogo() {
    // STUB: Returns a placeholder logo.
    // TODO: Connect to `profiles` table or Storage `logos` bucket once Agent 2 implementation is ready.
    // For now, we return a high-quality relevant placeholder or null.
    // Returing null will trigger the "RailVision" text fallback in UI.
    return null;
}

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

export async function testResendConnectivity(apiKey: string, fromEmail: string, toEmail: string) {
    try {
        // Dynamic import to prevent build errors if 'resend' isn't used elsewhere or causes edge issues
        const { Resend } = await import('resend');
        const resend = new Resend(apiKey);

        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: toEmail,
            subject: 'Test Connectivity from RailVision Admin',
            html: '<p>If you see this, the API Key works!</p>'
        });

        if (error) {
            return { success: false, error: error };
        }
        return { success: true, data };
    } catch (err: any) {
        console.error('Test Resend Connectivity Error:', err);
        return { success: false, error: err.message || 'Unknown error' };
    }
}

export async function getTenantStats() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // 1. Total Generations
    const { count: totalGenerations } = await supabase
        .from('generations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', user.id);

    // 2. Top Style
    const { data: styleData } = await supabase
        .from('generations')
        .select('style_id')
        .eq('organization_id', user.id);

    const styleCounts: Record<string, number> = {};
    styleData?.forEach((g: any) => {
        if (g.style_id) styleCounts[g.style_id] = (styleCounts[g.style_id] || 0) + 1;
    });

    const topStyle = Object.entries(styleCounts)
        .sort((a, b) => b[1] - a[1])[0];

    return {
        totalGenerations: totalGenerations || 0,
        topStyle: topStyle ? topStyle[0] : 'None'
    };
}
