import { createClient } from '@supabase/supabase-js';

// SERVER-SIDE ONLY
export const createAdminClient = () => {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        console.error("FATAL: SUPABASE_SERVICE_ROLE_KEY is missing in createAdminClient.");
        // We return null so the caller can handle 'simulation mode' if desired, 
        // or we could throw. For now, matching existing logic:
        return null;
    }

    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );
};
