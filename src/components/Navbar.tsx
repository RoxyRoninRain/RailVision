import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';

export default function Navbar() {
    return (
        <nav className="fixed top-0 left-0 w-full z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md">
            <div className="w-full bg-gradient-to-r from-green-400/90 to-green-500/90 text-black text-center py-1.5 text-xs font-bold tracking-widest uppercase">
                🚀 Launching Soon!
            </div>
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Link href="/" className="relative w-48 h-12">
                        <Image
                            src="/logo.png"
                            alt="Railify Logo"
                            fill
                            className="object-contain object-left"
                            priority
                        />
                    </Link>
                </div>

                <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
                    <Link href="/#features" className="hover:text-white transition-colors">Features</Link>
                    <Link href="/#pricing" className="hover:text-white transition-colors">Pricing</Link>
                    <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
                </div>

                <div className="flex items-center gap-4">
                    <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Log in</Link>
                    <Link href="/signup" className="bg-white text-black px-4 py-2 rounded-full text-sm font-bold hover:bg-gray-200 transition-colors">
                        Get Started
                    </Link>
                </div>
            </div>
        </nav>
    );
}
