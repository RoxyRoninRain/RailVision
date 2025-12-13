'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Settings, PenTool, LogOut, Shield } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const navItems = [
        { name: 'Leads Pipeline', href: '/dashboard/leads', icon: LayoutDashboard },
        { name: 'Shop Settings', href: '/dashboard/settings', icon: Settings },
        { name: 'Visualizer Tool', href: '/', icon: PenTool },
    ];

    return (
        <div className="flex min-h-screen bg-black font-sans text-white">
            {/* Sidebar */}
            <aside className="w-64 border-r border-gray-800 bg-[#050505] flex flex-col fixed h-full z-20 hidden md:flex">
                <div className="p-6 border-b border-gray-800 flex items-center gap-2">
                    <Shield className="text-[var(--primary)]" />
                    <span className="font-mono font-bold tracking-tighter text-lg uppercase">
                        RailVision <span className="text-[var(--primary)] text-xs align-top">PRO</span>
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
                    <button className="flex items-center gap-2 text-gray-500 hover:text-red-400 transition-colors text-sm font-mono uppercase">
                        <LogOut size={16} /> Sign Out
                    </button>
                    <p className="mt-4 text-[10px] text-gray-700 font-mono">
                        v2.5.0 • Mississippi Metal
                    </p>
                </div>
            </aside>

            {/* Mobile Header (visible only on small screens) */}
            <div className="md:hidden fixed top-0 w-full bg-[#050505] border-b border-gray-800 z-20 p-4 flex justify-between items-center text-[var(--primary)]">
                <span className="font-mono font-bold tracking-tighter uppercase">RailVision PRO</span>
                {/* Mobile menu toggle would go here */}
            </div>

            {/* Main Content */}
            <main className="flex-1 md:ml-64 p-0">
                {children}
            </main>
        </div>
    );
}
