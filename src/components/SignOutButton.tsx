'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SignOutButton({
    className,
    children
}: {
    className?: string,
    children: React.ReactNode
}) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const handleSignOut = async () => {
        try {
            setLoading(true);
            await supabase.auth.signOut();
            router.push('/login');
            router.refresh();
        } catch (error) {
            console.error('Sign out error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleSignOut}
            className={className}
            disabled={loading}
        >
            {children}
        </button>
    );
}
