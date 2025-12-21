'use server';

import { createClient } from '@/lib/supabase/server';

// --- Portfolio Actions ---

export async function createStyle(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Not authenticated' };

    // 1. Validate Files
    // Support legacy 'file' or new 'files' keys
    const files = formData.getAll('files') as File[];
    const singleFile = formData.get('file') as File;

    // Consolidate
    let allFiles: File[] = [];
    if (files && files.length > 0) allFiles = files;
    else if (singleFile) allFiles = [singleFile];

    if (allFiles.length === 0) return { error: 'No files uploaded' };

    // Limit: Max 4 images (1 Main + 3 Refs) usually, but code handles N
    if (allFiles.length > 5) return { error: 'Too many files (Max 5)' };

    const galleryUrls: string[] = [];
    const MAX_SIZE = 4.5 * 1024 * 1024;

    // 2. Upload Loop
    for (const file of allFiles) {
        if (file.size > MAX_SIZE) {
            return { error: `File ${file.name} too large. Max 4.5MB.` };
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('portfolio')
            .upload(fileName, file, { contentType: file.type, upsert: false });

        if (uploadError) {
            console.error('Upload Error:', uploadError);
            return { error: 'Upload failed for ' + file.name };
        }

        const { data: publicUrlData } = supabase.storage.from('portfolio').getPublicUrl(fileName);
        galleryUrls.push(publicUrlData.publicUrl);
    }

    const name = formData.get('name') as string;
    const desc = formData.get('description') as string;
    const priceMin = formData.get('price_min') ? parseFloat(formData.get('price_min') as string) : 0;
    const priceMax = formData.get('price_max') ? parseFloat(formData.get('price_max') as string) : 0;

    // 3. Insert into DB
    // First image is "image_url" (Thumbnail/Main), Rest are "reference_images" (Hidden Context)
    const mainImage = galleryUrls[0];
    const hiddenRefs = galleryUrls.slice(1);

    const { data, error: dbError } = await supabase
        .from('portfolio')
        .insert({
            name,
            description: desc,
            image_url: mainImage,
            reference_images: hiddenRefs,
            tenant_id: user.id,
            is_active: true,
            price_per_ft_min: priceMin,
            price_per_ft_max: priceMax
        })
        .select()
        .single();

    if (dbError) {
        console.error('DB Insert Error:', dbError);
        return { error: 'Database error: ' + dbError.message };
    }

    return { success: true };
}

export async function updateStyle(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Not authenticated' };

    const styleId = formData.get('id') as string;
    if (!styleId) return { error: 'Style ID required' };

    // 1. Handle Main Image Replace (Optional)
    const file = formData.get('file') as File;
    let mainImage = null;

    if (file && file.size > 0) {
        if (file.size > 5 * 1024 * 1024) {
            return { error: `File ${file.name} too large. Max 5MB.` };
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}_update_main_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('portfolio')
            .upload(fileName, file, { contentType: file.type, upsert: false });

        if (uploadError) {
            console.error('Update Main Upload Error:', uploadError);
            return { error: 'Main image upload failed' };
        }

        const { data: publicUrlData } = supabase.storage.from('portfolio').getPublicUrl(fileName);
        mainImage = publicUrlData.publicUrl;
    }

    // 2. Handle Reference Images (New Uploads)
    // Support multiple 'reference_files'
    const referenceFiles = formData.getAll('reference_files') as File[];
    const newRefUrls: string[] = [];

    if (referenceFiles && referenceFiles.length > 0) {
        for (const refFile of referenceFiles) {
            if (refFile.size > 5 * 1024 * 1024) continue; // Skip large files or handle error
            const ext = refFile.name.split('.').pop();
            const refName = `${user.id}/${Date.now()}_ref_${Math.random().toString(36).substring(7)}.${ext}`;

            const { error: refErr } = await supabase.storage
                .from('portfolio')
                .upload(refName, refFile, { contentType: refFile.type, upsert: false });

            if (!refErr) {
                const { data: pubData } = supabase.storage.from('portfolio').getPublicUrl(refName);
                newRefUrls.push(pubData.publicUrl);
            }
        }
    }

    // 3. Handle Existing Reference Images (Preservation)
    // Client sends 'kept_reference_urls' (JSON array) containing the OLD urls they want to keep.
    // If not provided, we assume NO changes to existing list? 
    // Or simpler: We assume 'kept_reference_urls' contains the list of *existing* images to keep.
    // We combine kept + new.
    let finalRefList: string[] | undefined = undefined;
    const keptRefsJson = formData.get('kept_reference_urls') as string;

    if (keptRefsJson || newRefUrls.length > 0) {
        const keptRefs = keptRefsJson ? JSON.parse(keptRefsJson) : [];

        // However, if the client DID NOT send kept_reference_urls, does it mean "keep all" or "delete all"?
        // Safe bet: If 'kept_reference_urls' is NOT present, we DO NOT touch the existing list (unless we want to purely append).
        // But if we want to support deletion, we MUST send the list.
        // Let's enforce: If you want to modify references, send 'kept_reference_urls' (empty if clearing all).
        // If undefined, we append new ones to the DB's current list (requires fetch).

        if (keptRefsJson !== null) {
            // Explicit list provided
            finalRefList = [...keptRefs, ...newRefUrls];
        } else {
            // Just append mode (fetch existing first)
            const { data: currentStyle } = await supabase.from('portfolio').select('reference_images').eq('id', styleId).single();
            const currentRefs = currentStyle?.reference_images || [];
            finalRefList = [...currentRefs, ...newRefUrls];
        }
    }

    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const priceMin = formData.get('price_min') ? parseFloat(formData.get('price_min') as string) : undefined;
    const priceMax = formData.get('price_max') ? parseFloat(formData.get('price_max') as string) : undefined;

    // 4. Prepare Update Object
    const updates: any = {};
    if (name) updates.name = name;
    if (description !== null) updates.description = description;
    if (priceMin !== undefined) updates.price_per_ft_min = priceMin;
    if (priceMax !== undefined) updates.price_per_ft_max = priceMax;
    if (mainImage) updates.image_url = mainImage;
    if (finalRefList !== undefined) updates.reference_images = finalRefList;

    const { error: dbError } = await supabase
        .from('portfolio')
        .update(updates)
        .eq('id', styleId)
        .eq('tenant_id', user.id);

    if (dbError) {
        console.error('DB Update Error:', dbError);
        return { error: 'Database error: ' + dbError.message };
    }

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
        { name: 'Industrial', description: 'Raw steel and exposed elements', image_url: '/styles/industrial.png' },
        { name: 'Modern', description: 'Clean lines and glass', image_url: '/styles/modern.png' },
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
    // Use Admin Client to bypass RLS for public portfolio access
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();

    // Fallback if Admin Client fails (simulated env or missing key)
    if (!supabase) {
        console.warn('getPublicStyles: No Admin Client, falling back to anon client (may fail RLS)');
        const standardClient = await createClient();
        const { data, error } = await standardClient
            .from('portfolio')
            .select('id, name, description, image_url, price_per_ft_min, price_per_ft_max') // Exclude reference_images
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Get Public Styles (Anon) Error:', error);
            return [];
        }
        return data;
    }

    const { data, error } = await supabase
        .from('portfolio')
        .select('id, name, description, image_url, price_per_ft_min, price_per_ft_max') // Exclude reference_images
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
        .select('id, name, description, image_url, price_per_ft_min, price_per_ft_max') // Exclude reference_images
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
