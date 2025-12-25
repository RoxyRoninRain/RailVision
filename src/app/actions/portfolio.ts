'use server';

import { createClient } from '@/lib/supabase/server';

// --- Portfolio Actions ---

export async function createStyle(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Not authenticated' };

    // --- ADMIN OVERRIDE ---
    const adminTenantId = formData.get('admin_tenant_id') as string;
    let targetTenantId = user.id;
    let actingSupabase = supabase;

    if (adminTenantId) {
        const { checkIsAdmin } = await import('@/lib/auth-utils');
        const isAdmin = await checkIsAdmin();
        if (!isAdmin) return { error: 'Unauthorized Admin Access' };

        targetTenantId = adminTenantId;
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const adminClient = createAdminClient();
        if (adminClient) actingSupabase = adminClient;
    }
    // ----------------------

    // 1. Validate Files
    // Support legacy 'file' or new 'files' keys
    const files = formData.getAll('files') as File[];
    const singleFile = formData.get('file') as File;

    // Consolidate
    let allFiles: File[] = [];
    if (files && files.length > 0) allFiles = files;
    else if (singleFile) allFiles = [singleFile];

    if (allFiles.length === 0 && !formData.get('image_url')) return { error: 'No files uploaded' };

    // Limit: Max 4 images (1 Main + 3 Refs) usually, but code handles N
    if (allFiles.length > 5) return { error: 'Too many files (Max 5)' };

    const galleryUrls: string[] = [];
    const MAX_SIZE = 4.5 * 1024 * 1024;

    // 2. Upload Loop OR Client-Side URL extraction
    // CHECK FOR PRE-UPLOADED URLs (Scalability Fix)
    const directMainUrl = formData.get('image_url') as string;
    const directRefUrlsJson = formData.get('reference_urls') as string;

    if (directMainUrl) {
        galleryUrls.push(directMainUrl);
        if (directRefUrlsJson) {
            const refs = JSON.parse(directRefUrlsJson);
            galleryUrls.push(...refs);
        }
    } else {
        // Fallback: Server-Side Upload (Legacy/Small files)
        for (const file of allFiles) {
            if (file.size > MAX_SIZE) {
                return { error: `File ${file.name} too large. Max 4.5MB.` };
            }

            const fileExt = file.name.split('.').pop();
            const fileName = `${targetTenantId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error: uploadError } = await actingSupabase.storage
                .from('portfolio')
                .upload(fileName, file, { contentType: file.type, upsert: false });

            if (uploadError) {
                console.error('Upload Error:', uploadError);
                return { error: 'Upload failed for ' + file.name };
            }

            const { data: publicUrlData } = actingSupabase.storage.from('portfolio').getPublicUrl(fileName);
            galleryUrls.push(publicUrlData.publicUrl);
        }
    }

    const name = formData.get('name') as string;
    const desc = formData.get('description') as string;
    const priceMin = formData.get('price_min') ? parseFloat(formData.get('price_min') as string) : 0;
    const priceMax = formData.get('price_max') ? parseFloat(formData.get('price_max') as string) : 0;

    // 3. Insert into DB
    // First image is "image_url" (Thumbnail/Main), Rest are "reference_images" (Hidden Context)
    const mainImage = galleryUrls[0];
    const hiddenRefs = galleryUrls.slice(1);

    // Get current max display_order
    const { data: maxOrderData } = await actingSupabase
        .from('portfolio')
        .select('display_order')
        .eq('tenant_id', targetTenantId)
        .order('display_order', { ascending: false })
        .limit(1)
        .single();

    const nextOrder = (maxOrderData?.display_order ?? 0) + 1;

    const { data, error: dbError } = await actingSupabase
        .from('portfolio')
        .insert({
            name,
            description: desc,
            image_url: mainImage,
            reference_images: hiddenRefs,
            tenant_id: targetTenantId,
            is_active: true,
            price_per_ft_min: priceMin,
            price_per_ft_max: priceMax,
            display_order: nextOrder
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

    // --- ADMIN OVERRIDE ---
    const adminTenantId = formData.get('admin_tenant_id') as string;
    let targetTenantId = user.id;
    let actingSupabase = supabase;

    if (adminTenantId) {
        const { checkIsAdmin } = await import('@/lib/auth-utils');
        const isAdmin = await checkIsAdmin();
        if (!isAdmin) return { error: 'Unauthorized Admin Access' };

        targetTenantId = adminTenantId;
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const adminClient = createAdminClient();
        if (adminClient) actingSupabase = adminClient;
    }
    // ----------------------

    // 1. Handle Main Image Replace (Optional)

    // Check for direct URL first
    const directMainUrl = formData.get('image_url') as string;

    const file = formData.get('file') as File;
    let mainImage = null;

    if (directMainUrl) {
        mainImage = directMainUrl;
    } else if (file && file.size > 0) {
        if (file.size > 5 * 1024 * 1024) {
            return { error: `File ${file.name} too large. Max 5MB.` };
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${targetTenantId}/${Date.now()}_update_main_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await actingSupabase.storage
            .from('portfolio')
            .upload(fileName, file, { contentType: file.type, upsert: false });

        if (uploadError) {
            console.error('Update Main Upload Error:', uploadError);
            return { error: 'Main image upload failed' };
        }

        const { data: publicUrlData } = actingSupabase.storage.from('portfolio').getPublicUrl(fileName);
        mainImage = publicUrlData.publicUrl;
    }

    // 2. Handle Reference Images (New Uploads)
    // Support multiple 'reference_files'
    const referenceFiles = formData.getAll('reference_files') as File[];
    const newRefUrls: string[] = [];

    // Check for direct URLs for new refs
    const directNewRefUrlsJson = formData.get('new_reference_urls') as string;

    if (directNewRefUrlsJson) {
        const refs = JSON.parse(directNewRefUrlsJson);
        newRefUrls.push(...refs);
    }

    // Legacy fallback
    if (referenceFiles && referenceFiles.length > 0) {
        for (const refFile of referenceFiles) {
            if (refFile.size > 5 * 1024 * 1024) continue; // Skip large files or handle error
            const ext = refFile.name.split('.').pop();
            const refName = `${targetTenantId}/${Date.now()}_ref_${Math.random().toString(36).substring(7)}.${ext}`;

            const { error: refErr } = await actingSupabase.storage
                .from('portfolio')
                .upload(refName, refFile, { contentType: refFile.type, upsert: false });

            if (!refErr) {
                const { data: pubData } = actingSupabase.storage.from('portfolio').getPublicUrl(refName);
                newRefUrls.push(pubData.publicUrl);
            }
        }
    }

    // 3. Handle Existing Reference Images (Preservation)
    let finalRefList: string[] | undefined = undefined;
    const keptRefsJson = formData.get('kept_reference_urls') as string;

    if (keptRefsJson || newRefUrls.length > 0) {
        const keptRefs = keptRefsJson ? JSON.parse(keptRefsJson) : [];

        if (keptRefsJson !== null) {
            // Explicit list provided
            finalRefList = [...keptRefs, ...newRefUrls];
        } else {
            // Just append mode (fetch existing first)
            const { data: currentStyle } = await actingSupabase.from('portfolio').select('reference_images').eq('id', styleId).single();
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

    const { error: dbError } = await actingSupabase
        .from('portfolio')
        .update(updates)
        .eq('id', styleId)
        .eq('tenant_id', targetTenantId);

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

    // --- ADMIN CHECK ---
    let actingSupabase = supabase;

    // Check if user owns it
    const { count } = await supabase.from('portfolio').select('id', { count: 'exact', head: true }).eq('id', styleId).eq('tenant_id', user.id);

    if (count === 0) {
        // Not owner. Check Admin.
        const { checkIsAdmin } = await import('@/lib/auth-utils');
        const isAdmin = await checkIsAdmin();
        if (isAdmin) {
            const { createAdminClient } = await import('@/lib/supabase/admin');
            const adminClient = createAdminClient();
            if (adminClient) {
                actingSupabase = adminClient;
            }
        } else {
            return { error: 'Unauthorized or Style not found' };
        }
    }

    const { error } = await actingSupabase
        .from('portfolio')
        .delete()
        .eq('id', styleId);

    if (error) return { error: error.message };
    return { success: true };
}

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
        .order('display_order', { ascending: true })
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
            .order('display_order', { ascending: true })
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
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Get Public Styles Error:', error);
        return [];
    }

    return data;
}

export async function getStyles(tenantId?: string) {
    const supabase = await createClient();
    const { data } = await supabase
        .from('portfolio')
        .select('id, name, description, image_url, price_per_ft_min, price_per_ft_max') // Exclude reference_images
        .eq('tenant_id', tenantId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

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

export async function reorderStyles(items: { id: string; order: number }[]) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Not authenticated' };

    try {
        const updates = items.map(item =>
            supabase
                .from('portfolio')
                .update({ display_order: item.order })
                .eq('id', item.id)
                .eq('tenant_id', user.id)
        );

        await Promise.all(updates);
        return { success: true };
    } catch (err: any) {
        console.error('Reorder Error:', err);
        return { error: 'Failed to reorder styles' };
    }
}
