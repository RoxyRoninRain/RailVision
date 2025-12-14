import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import SignOutButton from '@/components/SignOutButton';
import { LogOut } from 'lucide-react';

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
        <div className="h-screen bg-black text-white flex overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 border-r border-gray-800 p-6 flex flex-col gap-6 overflow-y-auto">
                <div className="text-[var(--primary)] font-mono text-xl font-bold">SUPER ADMIN</div>
                <nav className="flex flex-col gap-2 flex-1">
                    <a href="/admin/stats" className="p-2 hover:bg-white/5 rounded text-gray-400 hover:text-white">Global Stats</a>
                    <a href="/admin/tenants" className="p-2 hover:bg-white/5 rounded text-gray-400 hover:text-white">Tenants List</a>
                    <a href="/admin/prompts" className="p-2 hover:bg-white/5 rounded text-gray-400 hover:text-white">Prompt Settings</a>
                </nav>

                <div className="border-t border-gray-800 pt-4">
                    <SignOutButton className="flex items-center gap-2 text-gray-500 hover:text-red-400 transition-colors text-sm font-mono uppercase w-full">
                        <LogOut size={16} /> Sign Out
                    </SignOutButton>
                </div>
            </aside>
            <main className="flex-1 p-8 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
