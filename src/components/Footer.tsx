import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
    return (
        <footer className="py-12 border-t border-white/5 bg-black text-gray-500 text-sm">
            <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="relative w-32 h-10">
                            <Image
                                src="/logo.png"
                                alt="Railify Logo"
                                fill
                                className="object-contain object-left"
                            />
                        </div>
                    </div>
                    <p className="leading-relaxed">
                        The #1 White-Label AI Handrail &amp; Stair Railing Visualizer and Instant Quote Estimator for custom fabricators.
                    </p>
                </div>
                <div>
                    <h4 className="font-bold text-white mb-4">Product</h4>
                    <ul className="space-y-2">
                        <li><Link href="/#features" className="hover:text-primary">Features</Link></li>
                        <li><Link href="/pricing" className="hover:text-primary">Pricing &amp; Plans</Link></li>
                        <li><Link href="/#faq" className="hover:text-primary">FAQ</Link></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold text-white mb-4">Resources</h4>
                    <ul className="space-y-2">
                        <li><Link href="/contact" className="hover:text-primary">Contact Support</Link></li>
                        <li><Link href="/signup" className="hover:text-primary">Fabricator Sign Up</Link></li>
                        <li><a href="/llms.txt" className="hover:text-primary">AI / LLMs Guide</a></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold text-white mb-4">Legal</h4>
                    <ul className="space-y-2">
                        <li><Link href="/privacy" className="hover:text-primary">Privacy Policy</Link></li>
                        <li><Link href="/terms" className="hover:text-primary">Terms of Service</Link></li>
                    </ul>
                </div>
            </div>
            <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-white/5 text-center">
                © 2026 Railify. All rights reserved.
            </div>
        </footer>
    );
}
