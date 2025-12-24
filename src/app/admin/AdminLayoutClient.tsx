'use client';

import { useState } from 'react';
import { Menu, LogOut, X, Presentation } from 'lucide-react';
import SignOutButton from '@/components/SignOutButton';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayoutClient({
    children
}: {
    children: React.ReactNode
}) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const pathname = usePathname();

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const closeSidebar = () => setIsSidebarOpen(false);

    const isActive = (path: string) => pathname?.startsWith(path) ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5';

    return (
        <div className="h-screen bg-black text-white flex overflow-hidden">
            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#111] border-b border-gray-800 flex items-center justify-between px-4 z-50">
                <div className="text-[var(--primary)] font-mono text-xl font-bold">SUPER ADMIN</div>
                <button
                    onClick={toggleSidebar}
                    className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                    {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-64 bg-[#0a0a0a] border-r border-gray-800 p-6 flex flex-col gap-6 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="hidden lg:block text-[var(--primary)] font-mono text-xl font-bold">SUPER ADMIN</div>

                <nav className="flex flex-col gap-2 flex-1 mt-16 lg:mt-0">
                    <Link
                        href="/admin/stats"
                        onClick={closeSidebar}
                        className={`p-2 rounded transition-colors ${isActive('/admin/stats')}`}
                    >
                        Global Stats
                    </Link>
                    <Link
                        href="/admin/costs"
                        onClick={closeSidebar}
                        className={`p-2 rounded transition-colors ${isActive('/admin/costs')}`}
                    >
                        Cost Breakdown
                    </Link>
                    <Link
                        href="/admin/demo-leads"
                        onClick={closeSidebar}
                        className={`p-2 rounded transition-colors ${isActive('/admin/demo-leads')}`}
                        title="Landing Page Demo Leads"
                    >
                        <div className="flex items-center gap-2">
                            <Presentation size={18} />
                            <span>Demo Leads</span>
                        </div>
                    </Link>
                    <Link
                        href="/admin/tenants"
                        onClick={closeSidebar}
                        className={`p-2 rounded transition-colors ${isActive('/admin/tenants')}`}
                    >
                        Tenants List
                    </Link>
                    <Link
                        href="/admin/prompts"
                        onClick={closeSidebar}
                        className={`p-2 rounded transition-colors ${isActive('/admin/prompts')}`}
                    >
                        Prompt Settings
                    </Link>
                    <Link
                        href="/admin/styles"
                        onClick={closeSidebar}
                        className={`p-2 rounded transition-colors ${isActive('/admin/styles')}`}
                    >
                        Style Library
                    </Link>
                </nav>

                <div className="border-t border-gray-800 pt-4">
                    <SignOutButton className="flex items-center gap-2 text-gray-500 hover:text-red-400 transition-colors text-sm font-mono uppercase w-full p-2 rounded hover:bg-white/5">
                        <LogOut size={16} /> Sign Out
                    </SignOutButton>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-4 lg:p-8 overflow-y-auto pt-20 lg:pt-8 w-full">
                {children}
            </main>
        </div>
    );
}
