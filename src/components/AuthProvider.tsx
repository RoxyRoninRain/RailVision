'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const supabase = createClient();

    const pathname = usePathname();

    useEffect(() => {
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.access_token && pathname !== '/login') {
                // Trigger a refresh to update server-side cookies/state
                // BUT only if we are not on the login page, where we expect a manual router.push
                router.refresh();
            }

            if (event === 'SIGNED_OUT') {
                router.refresh();
                router.push('/login');
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [router, supabase, pathname]);

    return <>{children}</>;
}
