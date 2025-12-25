'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.access_token !== undefined) {
                // Trigger a refresh to update server-side cookies/state
                router.refresh();
            }

            // Optional: Handle SIGNED_OUT explicitly if needed, but router.refresh() 
            // combined with middleware usually handles the redirect logic.
            if (event === 'SIGNED_OUT') {
                router.refresh();
                router.push('/login');
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [router, supabase]);

    return <>{children}</>;
}
