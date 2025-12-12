import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    console.log('[ADMIN CHECK] Current User:', user?.email); // Debug log

    // strict security check
    if (!user || !['admin@railvision.com', 'me@railvision.com'].includes(user.email || '')) {
        console.log('[ADMIN CHECK] Access Denied. Serving 404.');
        // 404 to hide existence
        return notFound();
    }

    return (
        <div className="min-h-screen bg-black text-white flex">
            {/* Sidebar */}
            <aside className="w-64 border-r border-gray-800 p-6 flex flex-col gap-6">
                <div className="text-[var(--primary)] font-mono text-xl font-bold">SUPER ADMIN</div>
                <nav className="flex flex-col gap-2">
                    <a href="/admin/stats" className="p-2 hover:bg-white/5 rounded text-gray-400 hover:text-white">Global Stats</a>
                    <a href="/admin/tenants" className="p-2 hover:bg-white/5 rounded text-gray-400 hover:text-white">Tenants List</a>
                </nav>
            </aside>
            <main className="flex-1 p-8 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
