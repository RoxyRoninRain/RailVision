'use server';

import { InputSanitizer } from '@/components/security/InputSanitizer';

import { createClient } from '@/lib/supabase/server';
import { supabase as adminSupabase } from '@/lib/supabase'; // Keep admin/anon client for specific uses if needed, but prefer server client for actions
import { generateDesignWithNanoBanana } from '@/lib/vertex';

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

        let styleInput: string | { base64StyleImage: string } = style;

        if (styleFile) {
            const styleBuffer = Buffer.from(await styleFile.arrayBuffer());
            const styleBase64 = styleBuffer.toString('base64');
            styleInput = { base64StyleImage: styleBase64 };
            console.log('[DEBUG] Using CUSTOM Style Image for Nano Banana fusion');
        } else {
            // Check if it's a known preset and load the local image
            const presetMap: Record<string, string> = {
                'Industrial': 'industrial.png',
                'Modern': 'modern.png',
                'Rustic': 'rustic.png'
            };

            const presetFile = presetMap[style];
            if (presetFile) {
                try {
                    const fs = await import('fs'); // Dynamic import to avoid build issues if mixed env
                    const path = await import('path');
                    const filePath = path.join(process.cwd(), 'public', 'styles', presetFile);

                    if (fs.existsSync(filePath)) {
                        const fileBuffer = fs.readFileSync(filePath);
                        const styleBase64 = fileBuffer.toString('base64');
                        styleInput = { base64StyleImage: styleBase64 };
                        console.log(`[DEBUG] Using PRESET Style Image (${style}) for Nano Banana fusion`);
                    } else {
                        console.warn(`[DEBUG] Preset file not found: ${filePath}, falling back to text`);
                    }
                } catch (err) {
                    console.error('[DEBUG] Failed to load preset image:', err);
                }
            } else {
                console.log('[DEBUG] Using Style Text for Nano Banana generation:', style);
            }
        }

        // Use Nano Banana Pro (Gemini 3.0)
        // 1. Fetch dynamic prompt configuration
        const { getSystemPrompt } = await import('@/app/admin/actions');
        const promptData = await getSystemPrompt('gemini-handrail-main');

        let promptConfig = undefined;
        if (promptData) {
            promptConfig = {
                systemInstruction: promptData.system_instruction,
                userTemplate: promptData.user_template
            };
            console.log('[DEBUG] Using dynamic prompt from DB:', promptData.key);
        } else {
            console.log('[DEBUG] Using default fallback prompt (DB fetch failed or empty)');
        }

        const result = await generateDesignWithNanoBanana(base64Image, styleInput, promptConfig);

        if (result.success && result.image) {
            console.log('[DEBUG] Image generated successfully with Nano Banana');
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
        .select('shop_name, logo_url, phone, address, primary_color')
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
        redirectTo: 'https://railvision-six.vercel.app/auth/callback?next=/onboarding'
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
                redirectTo: 'https://railvision-six.vercel.app/auth/callback?next=/onboarding'
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

export interface PortfolioItem {
    id: string;
    name: string;
    description: string;
    image_url: string;
    tenant_id: string;
    created_at: string;
}

export async function createStyle(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Not authenticated' };

    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const file = formData.get('file') as File;

    if (!file || !name) return { error: 'Missing required fields' };

    // 1. Upload Image
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
        .from('portfolio')
        .upload(filePath, file);

    if (uploadError) {
        return { error: 'Upload failed: ' + uploadError.message };
    }

    const { data: { publicUrl } } = supabase.storage
        .from('portfolio')
        .getPublicUrl(filePath);

    // 2. Insert to DB
    const { error: dbError } = await supabase
        .from('portfolio')
        .insert({
            tenant_id: user.id,
            name,
            description,
            image_url: publicUrl
        });

    if (dbError) {
        return { error: dbError.message };
    }

    return { success: true };
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
        // Extract path from URL if needed, or just delete row
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

export async function getTenantStyles(tenantId?: string) {
    // If no tenantId provided, try to get current user's styles
    const supabase = await createClient();
    let targetTenantId = tenantId;

    if (!targetTenantId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) targetTenantId = user.id;
    }

    if (!targetTenantId) return [];

    const { data, error } = await supabase
        .from('portfolio')
        .select('*')
        .eq('tenant_id', targetTenantId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Get Tenant Styles Error:', error);
        return [];
    }

    return data;
}

export async function getStyles(tenantId?: string) {
    // If tenantId is present, fetch their styles.
    // If they have NO styles, or if no tenantId, return defaults? 
    // Spec: "IF a tenant_id is present... fetch that tenant's styles... ELSE show the default system styles."

    let customStyles: PortfolioItem[] = [];

    if (tenantId) {
        // We can use a public client or server client depending on RLS.
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

    const updates: any = {
        updated_at: new Date().toISOString(),
    };

    if (shop_name) updates.shop_name = shop_name;
    if (phone) updates.phone = phone;
    if (address) updates.address = address;
    if (primary_color) updates.primary_color = primary_color;

    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

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
    if (!file.type.startsWith('image/')) {
        return { error: 'File must be an image' };
    }
    if (file.size > 2 * 1024 * 1024) { // 2MB
        return { error: 'File size must be less than 2MB' };
    }

    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file, { upsert: true });

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

    const { data, error } = await supabase
        .from('leads')
        .select('organization_id, id');

    if (error) {
        console.error('Admin Stats Error:', error);
        return [];
    }

    // Aggregate by organization_id
    const stats: Record<string, number> = {};
    data.forEach((lead: any) => {
        const org = lead.organization_id || 'Unknown';
        stats[org] = (stats[org] || 0) + 1;
    });

    return Object.entries(stats).map(([org, count]) => ({ organization_id: org, count }));
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
