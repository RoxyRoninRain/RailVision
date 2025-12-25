'use server';

import { cookies } from 'next/headers';
import { checkIsAdmin } from '@/lib/auth-utils';
import { redirect } from 'next/navigation';

const IMPERSONATION_COOKIE = 'x-railify-impersonate';

export async function impersonateTenant(tenantId: string) {
    const isAdmin = await checkIsAdmin();

    if (!isAdmin) {
        return { error: 'Unauthorized' };
    }

    const cookieStore = await cookies();

    // Set cookie to expire in 1 hour
    cookieStore.set(IMPERSONATION_COOKIE, tenantId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 3600
    });

    // Redirect happens on client usually, or we can do it here
    redirect('/dashboard');
}

export async function stopImpersonating() {
    const cookieStore = await cookies();
    cookieStore.delete(IMPERSONATION_COOKIE);
    redirect('/admin');
}
