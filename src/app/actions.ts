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
            console.log('[DEBUG] Using Style Image for Nano Banana fusion');
        } else {
            console.log('[DEBUG] Using Style Text for Nano Banana generation:', style);
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
        return { error: 'Failed to generate image. ' + (error.message || 'Unknown error') };
    }
}

export async function submitLead(formData: FormData) {
    const supabase = await createClient();
    const email = formData.get('email') as string;
    const customer_name = formData.get('customer_name') as string || 'Guest';
    const style_name = formData.get('style_name') as string;
    const generated_design_url = formData.get('generated_design_url') as string;

    if (!email || !email.includes('@')) {
        return { success: false, error: 'Invalid email' };
    }

    // Look up style_id from name if provided
    let style_id = null;
    if (style_name) {
        const { data: style } = await supabase.from('portfolio').select('id').eq('name', style_name).single();
        if (style) style_id = style.id;
    }

    // Parse estimate (mock for now if not passed)
    const estimate_json = {
        base_price: 1500,
        travel_fee: 200,
        addons: [{ name: 'LED Lighting', price: 300 }],
        total: 2000
    };

    // Insert into Supabase
    // Note: For public insertion (anon), we might still need standard client if RLS allows anon insert
    // But 'createClient' uses cookies. If user is anon, it's fine.
    const { error } = await supabase
        .from('leads')
        .insert([{
            email,
            customer_name,
            style_id, // can be null
            generated_design_url, // can be null
            estimate_json,
            // organization_id will default to auth.uid() or null if anon
            created_at: new Date().toISOString()
        }]);

    if (error) {
        console.error('Supabase Error:', error);
        return { success: false, error: 'Database error' };
    }

    return { success: true };
}

export async function getStyles() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('portfolio')
        .select('id, name, description')
        .order('name');

    if (error) {
        console.error('Fetch Styles Error:', error);
        return [];
    }

    return data || [];
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

    const { error } = await supabase
        .from('profiles')
        .update({ shop_name, updated_at: new Date().toISOString() })
        .eq('id', user.id);

    if (error) {
        return { error: error.message };
    }

    return { success: true };
}

export async function getAdminStats() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Security Check
    // In real app, check a specific role or table. For now, check email.
    if (!user || !['admin@railvision.com', 'me@railvision.com'].includes(user.email || '')) {
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
