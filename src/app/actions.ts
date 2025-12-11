'use server';

import { InputSanitizer } from '@/components/security/InputSanitizer';
import { getGeminiModel } from '@/lib/vertex';
import { supabase } from '@/lib/supabase';

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
}

export async function generateDesign(formData: FormData) {
    const file = formData.get('image') as File;
    const style = formData.get('style') as string;

    if (!file || !style) {
        return { error: 'Missing image or style.' };
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

        const model = getGeminiModel();

        // Construct prompt
        const prompt = `Redesign this staircase in a ${style} style. 
    Remove existing railings and replace with a modern, high-contrast industrial design.
    Keep the structural elements but update the aesthetics to be premium and sleek.`;

        const result = await model.generateContent({
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: file.type || 'image/jpeg',
                                data: base64Image
                            }
                        }
                    ]
                }
            ]
        });

        const response = result.response;
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "Design generated.";

        return { success: true, data: text };

    } catch (error: any) {
        console.error('Vertex AI Error:', error);
        return { error: 'Failed to generate design. ' + (error.message || 'Unknown error') };
    }
}

export async function submitLead(formData: FormData) {
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
    // Note: we let RLS/Default handle organization_id (auth.uid)
    const { error } = await supabase
        .from('leads')
        .insert([{
            email,
            customer_name,
            style_id, // can be null
            generated_design_url, // can be null
            estimate_json,
            created_at: new Date().toISOString()
        }]);

    if (error) {
        console.error('Supabase Error:', error);
        return { success: false, error: 'Database error' };
    }

    return { success: true };
}

export async function getStyles() {
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

// === NEW ACTIONS ===

export async function getOwnerLeads(): Promise<Lead[]> {
    // Join leads with portfolio to get style name
    // RLS automatically filters by auth.uid() = organization_id
    const { data, error } = await supabase
        .from('leads')
        .select(`
      *,
      portfolio (
        name
      )
    `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Get Owner Leads Error:', error);
        return [];
    }

    // Flatten structure
    return data.map((lead: any) => ({
        ...lead,
        style_name: lead.portfolio?.name || 'Unknown'
    }));
}

export async function getAdminStats() {
    // Super Admin Only
    // Group by organization_id
    const { data, error } = await supabase
        .from('leads')
        .select('organization_id, id');

    if (error) {
        console.error('Admin Stats Error:', error);
        return [];
    }

    // Aggregate in JS (since Supabase Client doesn't do "GROUP BY" easily without RPC)
    const stats: Record<string, number> = {};
    data.forEach((lead: any) => {
        const org = lead.organization_id || 'Unknown';
        stats[org] = (stats[org] || 0) + 1;
    });

    return Object.entries(stats).map(([org, count]) => ({ organization_id: org, count }));
}
