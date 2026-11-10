'use server';

import { cookies } from 'next/headers';
import { checkIsAdmin } from '@/lib/auth-utils';
import { createClient } from '@/lib/supabase/server';
import { isValidUuid } from '@/lib/validations';
import { redirect } from 'next/navigation';

const IMPERSONATION_COOKIE = 'x-railify-impersonate';

export async function impersonateTenant(tenantId: string) {
    const isAdmin = await checkIsAdmin();

    if (!isAdmin) {
        return { error: 'Unauthorized' };
    }

    if (!isValidUuid(tenantId)) {
        return { error: 'Invalid tenant ID format' };
    }

    const cookieStore = await cookies();

    // Set cookie to expire in 1 hour
    cookieStore.set(IMPERSONATION_COOKIE, tenantId.trim(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 3600
    });

    redirect('/dashboard');
}

export async function stopImpersonating() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const cookieStore = await cookies();
    cookieStore.delete(IMPERSONATION_COOKIE);

    if (!user) {
        redirect('/login');
    }
    redirect('/admin');
}
