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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Not authenticated' };

    const shop_name = formData.get('shop_name') as string;
    const phone = formData.get('phone') as string;
    const address = formData.get('address') as string;
    const primary_color = formData.get('primary_color') as string;
    const tool_background_color = formData.get('tool_background_color') as string;
    const logo_size = formData.get('logo_size') ? Number(formData.get('logo_size')) : null;
    const logo_url = formData.get('logo_url') as string; // From client upload
    const watermark_logo_url = formData.get('watermark_logo_url') as string;
    const website = formData.get('website') as string;
    const address_zip = formData.get('address_zip') as string;
    const confirmation_email_body = formData.get('confirmation_email_body') as string;
    const travel_settings_raw = formData.get('travel_settings') as string;

    console.log('[DEBUG] updateProfile - User:', user.email);
    console.log('[DEBUG] updateProfile - Website Input:', website);
    console.log('[DEBUG] updateProfile - FormData Keys:', Array.from(formData.keys()));

    const updates: Partial<Profile> = {};
    if (shop_name) updates.shop_name = shop_name;
    if (phone) updates.phone = phone;
    if (address) updates.address = address;
    if (primary_color) updates.primary_color = primary_color;
    if (tool_background_color) updates.tool_background_color = tool_background_color;

    if (logo_size) updates.logo_size = logo_size;
    if (logo_url) updates.logo_url = logo_url;
    if (watermark_logo_url) updates.watermark_logo_url = watermark_logo_url;
    if (website !== undefined) updates.website = website;
    if (address_zip) updates.address_zip = address_zip;
    if (confirmation_email_body !== undefined) updates.confirmation_email_body = confirmation_email_body;
    if (travel_settings_raw) {
        try {
            updates.travel_settings = JSON.parse(travel_settings_raw);
        } catch (e) {
            console.error('Invalid travel_settings JSON', e);
        }
    }

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
