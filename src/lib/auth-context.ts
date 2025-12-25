
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkIsAdmin } from '@/lib/auth-utils';
import { cookies } from 'next/headers';

const IMPERSONATION_COOKIE = 'x-railify-impersonate';

export type ActingUserContext = {
    user: any; // The authenticated user (Admin or Regular)
    tenantId: string; // The effective tenant ID (Self or Impersonated)
    isImpersonating: boolean;
    supabase: any; // The client to use (Standard or Admin/Service Role)
    isAdmin: boolean;
};

export async function getActingUser(): Promise<ActingUserContext> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Default State: Regular User
    let context: ActingUserContext = {
        user,
        tenantId: user?.id || '',
        isImpersonating: false,
        supabase,
        isAdmin: false
    };

    if (!user) return context;

    // Check Admin Status
    const isAdmin = await checkIsAdmin();
    context.isAdmin = isAdmin;

    if (isAdmin) {
        // Check for Impersonation Cookie
        const cookieStore = await cookies();
        const impersonatedTenantId = cookieStore.get(IMPERSONATION_COOKIE)?.value;

        if (impersonatedTenantId) {
            context.isImpersonating = true;
            context.tenantId = impersonatedTenantId;

            // Upgrade to Admin Client to bypass RLS for the target tenant
            const adminClient = createAdminClient();
            if (adminClient) {
                context.supabase = adminClient;
            } else {
                console.error("CRITICAL: Failed to create Admin Client during impersonation.");
            }
        }
    }

    return context;
}
