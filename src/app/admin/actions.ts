'use server';

import { createClient } from '@/lib/supabase/server';

export interface SystemPrompt {
    key: string;
    system_instruction: string;
    user_template: string;
    active: boolean;
    updated_at: string;
}

export async function getSystemPrompt(key: string): Promise<SystemPrompt | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('system_prompts')
        .select('*')
        .eq('key', key)
        .single();

    if (error) {
        console.warn(`[getSystemPrompt] Failed to fetch prompt for key "${key}":`, error.message);
        return null;
    }

    return data;
}

export async function updateSystemPrompt(key: string, data: Partial<SystemPrompt>) {
    const supabase = await createClient();

    // Check Admin usage
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    // In a real app, strict RBAC here.
    // For now, we trust the dashboard page is protected or we add email check if critical.

    const { error } = await supabase
        .from('system_prompts')
        .upsert({
            key,
            ...data,
            updated_at: new Date().toISOString()
        });

    if (error) {
        console.error('[updateSystemPrompt] Error:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}
