'use server';

import { createClient } from '@/lib/supabase/server';
import { Profile } from './types';

export async function getTenantProfile(organizationId: string) {
    if (!organizationId) return null;

    // Use Admin Client to bypass RLS for public branding access
    // This is safe because we ONLY select public branding fields
    const { createAdminClient } = await import('@/lib/supabase/admin');

    // Force no store to prevent caching stale branding/whitelist
    const { unstable_noStore } = await import('next/cache');
    unstable_noStore();

    const supabase = createAdminClient();

    if (!supabase) {
        console.error('FATAL: Generic Tenant Profile Fetch Failed - No Admin Client');
        return null;
    }

    // Public fetch of branding details
    const { data, error } = await supabase
        .from('profiles')
        .select('shop_name, logo_url, phonenumber:phone, address, primary_color, tool_background_color, logo_size, watermark_logo_url, website, subscription_status, confirmation_email_body')
        .eq('id', organizationId)
        .single();


    if (error) {
        console.error('Fetch Tenant Profile Error:', error);
        return null;
    }

    return data;
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
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return { error: 'Not authenticated' };

        // Helper to convert formData nulls/empty strings to undefined
        const getString = (key: string) => {
            const v = formData.get(key);
            // Treat null (missing) AND empty string as undefined for optional logic
            return (v === null || v === '') ? undefined : String(v);
        };

        // Extract raw data for validation
        const rawData: any = {
            shop_name: getString('shop_name'),
            phone: getString('phone'),
            address: getString('address'),
            primary_color: getString('primary_color'),
            tool_background_color: getString('tool_background_color'),
            logo_url: getString('logo_url'), // Client upload URL
            watermark_logo_url: getString('watermark_logo_url'),
            website: getString('website'),
            address_zip: getString('address_zip'),
            confirmation_email_body: getString('confirmation_email_body'),
            enable_overdrive: formData.get('enable_overdrive') === 'true' || formData.get('enable_overdrive') === 'on',
        };

        // Number conversion
        const logoSize = formData.get('logo_size');
        if (logoSize) rawData.logo_size = Number(logoSize);

        const maxSpend = formData.get('max_monthly_spend');
        if (maxSpend !== null && maxSpend !== '') rawData.max_monthly_spend = Number(maxSpend);
        else if (maxSpend === '') rawData.max_monthly_spend = null;

        // JSON Parsing
        const travelSettingsRaw = formData.get('travel_settings') as string;
        if (travelSettingsRaw) {
            try {
                rawData.travel_settings = JSON.parse(travelSettingsRaw);
            } catch (e) {
                console.error('Invalid travel_settings JSON', e);
            }
        }

        // --- ZOD VALIDATION ---
        const { profileSchema } = await import('@/lib/validations');
        const result = profileSchema.safeParse(rawData);

        if (!result.success) {
            console.error('Validation Error Raw:', JSON.stringify(result.error));
            let errorMsg = 'Validation failed';
            const zodError = result.error as any;

            if (zodError && Array.isArray(zodError.errors)) {
                errorMsg = zodError.errors.map((e: any) => `${e.path ? e.path.join('.') : 'unknown'}: ${e.message}`).join(', ');
            } else if (zodError && zodError.message) {
                errorMsg = zodError.message;
            } else {
                errorMsg = 'Unknown validation error';
            }

            console.error('Profile Validation Failed Message:', errorMsg);
            return { error: `Validation Failed: ${errorMsg}` };
        }

        const val = result.data;

        // Construct updates object from VALIDATED data
        const updates: Partial<Profile> = {};
        if (val.shop_name !== undefined) updates.shop_name = val.shop_name;
        if (val.phone !== undefined) updates.phone = val.phone;
        if (val.address !== undefined) updates.address = val.address;
        if (val.primary_color !== undefined) updates.primary_color = val.primary_color;
        if (val.tool_background_color !== undefined) updates.tool_background_color = val.tool_background_color;
        if (val.logo_size !== undefined) updates.logo_size = val.logo_size;
        if (val.logo_url !== undefined) updates.logo_url = val.logo_url;
        if (val.watermark_logo_url !== undefined) updates.watermark_logo_url = val.watermark_logo_url;
        if (val.website !== undefined) updates.website = val.website;
        if (val.address_zip !== undefined) updates.address_zip = val.address_zip;
        if (val.confirmation_email_body !== undefined) updates.confirmation_email_body = val.confirmation_email_body;
        if (val.travel_settings !== undefined) updates.travel_settings = val.travel_settings;
        if (val.enable_overdrive !== undefined) updates.enable_overdrive = val.enable_overdrive;
        if (val.max_monthly_spend !== undefined) updates.max_monthly_spend = val.max_monthly_spend;

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
            console.error('Supabase Upsert Error:', error);
            return { error: error.message };
        }

        return { success: true };
    } catch (err: any) {
        console.error('FATAL Server Action Error:', err);
        return { error: `Server Exception: ${err.message || 'Unknown error'}` };
    }
}

export async function uploadLogo(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Not authenticated' };

    const file = formData.get('file') as File;
    const targetField = (formData.get('field') as string) || 'logo_url'; // 'logo_url' or 'watermark_logo_url'

    if (!file) return { error: 'No file provided' };

    // Validate file
    if (!file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
        return { error: 'File must be an image (PNG, JPG, SVG)' };
    }
    if (file.size > 2 * 1024 * 1024) { // 2MB
        return { error: 'File size must be less than 2MB' };
    }

    const fileExt = file.name.split('.').pop();
    const bucket = targetField === 'watermark_logo_url' ? 'logos' : 'logos'; // Could separate buckets later if needed
    const filePath = `${user.id}/${targetField}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
            upsert: true,
            contentType: file.type
        });

    if (uploadError) {
        return { error: uploadError.message };
    }

    const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

    // Update profile with the correct field
    const updatePayload: any = { updated_at: new Date().toISOString() };
    updatePayload[targetField] = publicUrl;

    const { error: updateError } = await supabase
        .from('profiles')
        .update(updatePayload)
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

export async function getTenantLogo() {
    // STUB: Returns a placeholder logo.
    // TODO: Connect to `profiles` table or Storage `logos` bucket once Agent 2 implementation is ready.
    // For now, we return a high-quality relevant placeholder or null.
    // Returing null will trigger the "RailVision" text fallback in UI.
    return null;
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
