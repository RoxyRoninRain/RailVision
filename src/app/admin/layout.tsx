import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import AdminLayoutClient from './AdminLayoutClient';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    console.log('[ADMIN CHECK] Current User:', user?.email); // Debug log

    // strict security check
    if (!user || !['admin@railify.com', 'me@railify.com'].includes(user.email || '')) {
        console.log('[ADMIN CHECK] Access Denied. Serving 404.');
        // 404 to hide existence
        return notFound();
    }

    return (
        <AdminLayoutClient>
            {children}
        </AdminLayoutClient>
    );
}
