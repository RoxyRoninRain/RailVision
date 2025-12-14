'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Settings, PenTool, LogOut, Shield, Menu, X, Code2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { seedDefaultStyles } from '@/app/actions';
import SignOutButton from '@/components/SignOutButton';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Auto-Seed Defaults on Dashboard Access
    useEffect(() => {
        seedDefaultStyles().then(res => {
            if (res.seeded) {
                console.log('Default styles seeded successfully.');
                // Optionally trigger a router refresh if strictly needed, but usually silent is fine for global state
            }
        });
    }, []);

    const navItems = [
        { name: 'Leads Pipeline', href: '/dashboard/leads', icon: LayoutDashboard },
        { name: 'Visualizer Styles', href: '/dashboard/styles', icon: PenTool },
        { name: 'Shop Settings', href: '/dashboard/settings', icon: Settings },
        { name: 'Widget Integration', href: '/dashboard/widget', icon: Code2 },
        { name: 'Visualizer Tool', href: '/', icon: PenTool },
    ];

    return (
        <div className="flex min-h-screen bg-black font-sans text-white">
            {/* Sidebar (Desktop) */}
            <aside className="w-64 border-r border-gray-800 bg-[#050505] flex flex-col fixed h-full z-20 hidden md:flex">
                <div className="p-6 border-b border-gray-800 flex items-center gap-2">
                    <Shield className="text-[var(--primary)]" />
                    <span className="font-mono font-bold tracking-tighter text-lg uppercase">
                        Railify <span className="text-[var(--primary)] text-xs align-top">PRO</span>
                    </span>
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

                <div className="p-6 border-t border-gray-800">
                    <SignOutButton className="flex items-center gap-2 text-gray-500 hover:text-red-400 transition-colors text-sm font-mono uppercase w-full">
                        <LogOut size={16} /> Sign Out
                    </SignOutButton>
                    <p className="mt-4 text-[10px] text-gray-700 font-mono">
                        v2.5.0 • Mississippi Metal
                    </p>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 w-full bg-[#050505] border-b border-gray-800 z-20 p-4 flex justify-between items-center text-[var(--primary)] shadow-lg">
                <div className="flex items-center gap-2">
                    <Shield className="text-[var(--primary)] w-6 h-6" />
                    <span className="font-mono font-bold tracking-tighter uppercase">Railify PRO</span>
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
                        className="fixed inset-0 z-10 bg-black/95 backdrop-blur-xl md:hidden pt-20 px-6 pb-6 flex flex-col"
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

                        <div className="mt-auto border-t border-gray-800 pt-6">
                            <SignOutButton className="w-full flex items-center justify-center gap-2 text-red-400 hover:bg-red-900/20 p-4 rounded-xl transition-colors text-sm font-mono uppercase font-bold">
                                <LogOut size={20} /> Sign Out
                            </SignOutButton>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="flex-1 md:ml-64 p-0 pt-20 md:pt-0">
                {children}
            </main>
        </div>
    );
}
