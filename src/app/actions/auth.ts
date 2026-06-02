'use server';

import { createClient } from '@supabase/supabase-js';

// We use the admin service role to bypass email confirmation limits
export async function adminSignUp(formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const fullName = formData.get('fullName') as string;

    if (!email || !password) {
        return { error: 'Email and password are required' };
    }

    try {
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName,
            },
        });

        if (error) throw error;

        return { user: data.user, error: null };
    } catch (error: any) {
        console.error('Admin Sign Up Error:', error);
        return { user: null, error: error.message };
    }
}
