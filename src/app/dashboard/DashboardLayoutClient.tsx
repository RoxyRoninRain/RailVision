'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Settings, PenTool, LogOut, Shield, Menu, X, Code2, MessageSquare, Upload, BarChart3, VenetianMask } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { seedDefaultStyles } from '@/app/actions';
import SignOutButton from '@/components/SignOutButton';
import { stopImpersonating } from '@/app/actions/impersonation';

interface DashboardLayoutClientProps {
    children: React.ReactNode;
    isImpersonating: boolean;
    impersonatedTenantId?: string;
    currentUserEmail?: string;
    shopName?: string;
}

export default function DashboardLayoutClient({
    children,
    isImpersonating,
    impersonatedTenantId,
    currentUserEmail, // Fallback if needed
    shopName: initialShopName
}: DashboardLayoutClientProps) {
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [shopName, setShopName] = useState<string>(initialShopName || '');

    // Auto-Seed Defaults on Dashboard Access
    // We can rely on server components mostly, but this seeding check is fine here.
    useEffect(() => {
        const init = async () => {
            await seedDefaultStyles();

            // Fetch Shop Name if not provided (e.g. slight delay in server prop) or refresh
            if (!shopName) {
                const { createClient } = await import('@/lib/supabase/client');
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase.from('profiles').select('shop_name').eq('id', user.id).single();
                    if (profile?.shop_name) {
                        setShopName(profile.shop_name);
                    }
                }
            }
        };
        init();
    }, [shopName]); // Depend on shopName to stop if set

    const navItems = [
        { name: 'Leads Pipeline', href: '/dashboard/leads', icon: LayoutDashboard },
        { name: 'Performance', href: '/dashboard/stats', icon: BarChart3 },
        { name: 'Visualizer Styles', href: '/dashboard/styles', icon: PenTool },
        { name: 'Widget Integration', href: '/dashboard/widget', icon: Code2 },
        { name: 'Onboarding', href: '/dashboard/onboarding', icon: Upload },
        { name: 'Visualizer Tool', href: '/demo', icon: PenTool },
        { name: 'Shop Settings', href: '/dashboard/settings', icon: Settings },
    ];

    return (
        <div className="flex min-h-screen bg-black font-sans text-white">
            {/* IMPERSONATION BANNER */}
            {isImpersonating && (
                <div className="fixed top-0 left-0 w-full bg-purple-900 text-white z-50 px-4 py-2 flex items-center justify-between shadow-lg border-b border-purple-500">
                    <div className="flex items-center gap-2 text-sm font-bold animate-pulse">
                        <VenetianMask size={18} />
                        <span>IMPERSONATING TENANT MODE</span>
                        <span className="bg-black/50 px-2 py-0.5 rounded text-xs font-mono">{impersonatedTenantId}</span>
                    </div>
                    <form action={stopImpersonating}>
                        <button type="submit" className="bg-white text-purple-900 px-3 py-1 rounded text-xs font-bold uppercase hover:bg-gray-200 transition-colors">
                            Exit Impersonation
                        </button>
                    </form>
                </div>
            )}

            {/* Sidebar (Desktop) */}
            <aside className={`w-64 border-r border-gray-800 bg-[#050505] flex flex-col fixed h-full z-20 hidden md:flex ${isImpersonating ? 'top-10' : 'top-0'}`}>
                <div className="p-6 border-b border-gray-800 flex items-center gap-2">
                    <div className="relative w-full h-12">
                        <Image
                            src="/logo.png"
                            alt="Railify PRO"
                            fill
                            className="object-contain object-left"
                            priority
                        />
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded transition-all font-mono text-sm uppercase tracking-wider ${isActive
                                    ? 'bg-[var(--primary)] text-black font-bold shadow-[0_0_15px_rgba(var(--primary-rgb),0.4)]'
                                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <Icon size={18} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-6 border-t border-gray-800 space-y-2">
                    <a
                        href="mailto:railifyai@gmail.com?subject=Railify%20Feedback"
                        className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm font-mono uppercase w-full"
                    >
                        <MessageSquare size={16} /> Feedback
                    </a>
                    {isImpersonating ? (
                        <div className="text-purple-400 text-xs font-mono border border-purple-900/50 p-2 rounded bg-purple-900/10 mb-2">
                            Admin Session Active
                        </div>
                    ) : (
                        <SignOutButton className="flex items-center gap-2 text-gray-500 hover:text-red-400 transition-colors text-sm font-mono uppercase w-full">
                            <LogOut size={16} /> Sign Out
                        </SignOutButton>
                    )}
                    <p className="mt-4 text-[10px] text-gray-700 font-mono">
                        v2.5.0 • {shopName || '...'}
                    </p>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className={`md:hidden fixed w-full bg-[#050505] border-b border-gray-800 z-20 p-4 flex justify-between items-center text-[var(--primary)] shadow-lg ${isImpersonating ? 'top-10' : 'top-0'}`}>
                <div className="flex items-center gap-2">
                    <div className="relative w-40 h-10">
                        <Image
                            src="/logo.png"
                            alt="Railify PRO"
                            fill
                            className="object-contain object-left"
                            priority
                        />
                    </div>
                </div>
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-2 text-gray-400 hover:text-white"
                >
                    {mobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={`fixed inset-0 z-10 bg-black/95 backdrop-blur-xl md:hidden pt-20 px-6 pb-6 flex flex-col ${isImpersonating ? 'top-10' : 'top-0'}`}
                    >
                        <nav className="flex-1 space-y-4">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`flex items-center gap-4 px-4 py-4 rounded-xl transition-all font-mono text-lg uppercase tracking-wider ${isActive
                                            ? 'bg-[var(--primary)] text-black font-bold'
                                            : 'text-gray-500 hover:text-white border border-white/10'
                                            }`}
                                    >
                                        <Icon size={24} />
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="mt-auto border-t border-gray-800 pt-6 space-y-2">
                            <a
                                href="mailto:railifyai@gmail.com?subject=Railify%20Feedback"
                                className="w-full flex items-center gap-4 px-4 py-3 text-gray-500 hover:text-white transition-colors text-lg font-mono uppercase tracking-wider"
                            >
                                <MessageSquare size={24} /> Feedback
                            </a>
                            <SignOutButton className="w-full flex items-center justify-center gap-2 text-red-400 hover:bg-red-900/20 p-4 rounded-xl transition-colors text-sm font-mono uppercase font-bold">
                                <LogOut size={20} /> Sign Out
                            </SignOutButton>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className={`flex-1 md:ml-64 p-0 pt-20 md:pt-0 ${isImpersonating ? 'mt-10' : ''}`}>
                {children}
            </main>
        </div>
    );
}
