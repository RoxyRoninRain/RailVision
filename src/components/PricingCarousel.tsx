'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import Link from 'next/link';
import { PRICING_TIERS, PricingTier } from '@/config/pricing';

export default function PricingCarousel() {
    // Convert object to array for easier mapping
    const tiers = Object.values(PRICING_TIERS);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [visibleCards, setVisibleCards] = useState(1);

    // Responsive visible cards
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) {
                setVisibleCards(3);
            } else if (window.innerWidth >= 768) {
                setVisibleCards(2);
            } else {
                setVisibleCards(1);
            }
        };

        handleResize(); // Init
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const nextSlide = () => {
        setCurrentIndex((prev) => (prev + 1) % tiers.length);
    };

    const prevSlide = () => {
        setCurrentIndex((prev) => (prev - 1 + tiers.length) % tiers.length);
    };

    // Auto-scroll
    useEffect(() => {
        const timer = setInterval(nextSlide, 5000); // 5s interval
        return () => clearInterval(timer);
    }, [currentIndex]); // Reset timer on interaction

    const getVisibleTiers = () => {
        const result = [];
        for (let i = 0; i < visibleCards; i++) {
            const index = (currentIndex + i) % tiers.length;
            result.push(tiers[index]);
        }
        return result;
    };

    return (
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Controls */}
            <div className="flex justify-end gap-2 mb-4">
                <button onClick={prevSlide} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors">
                    <ChevronLeft size={20} />
                </button>
                <button onClick={nextSlide} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors">
                    <ChevronRight size={20} />
                </button>
            </div>

            <div className="overflow-hidden">
                <motion.div
                    className="flex gap-6"
                    initial={false}
                    animate={{ x: 0 }} // Simplified for now, complex infinite scroll logic can be tricky with framer-motion grids
                >
                    <AnimatePresence mode='popLayout'>
                        {getVisibleTiers().map((tier, idx) => (
                            <motion.div
                                key={`${tier.name}-${currentIndex}-${idx}`} // Unique key to trigger animation on change
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                transition={{ duration: 0.3 }}
                                className={`flex-1 min-w-[300px] bg-[#111] border ${tier.popular ? 'border-[var(--primary)] shadow-[0_0_20px_rgba(var(--primary-rgb),0.15)]' : 'border-white/10'} rounded-2xl p-6 flex flex-col relative group hover:border-white/20 transition-colors`}
                            >
                                {tier.popular && (
                                    <div className="absolute top-0 right-0 bg-[var(--primary)] text-black text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">
                                        POPULAR
                                    </div>
                                )}

                                <div className="mb-6">
                                    <h3 className={`text-xl font-bold mb-2 ${tier.popular ? 'text-white' : 'text-gray-400'}`}>{tier.name}</h3>
                                    <div className="flex items-baseline gap-1 mb-2">
                                        <span className="text-3xl font-bold text-white">${tier.price}</span>
                                        <span className="text-gray-500 text-sm">/mo</span>
                                    </div>
                                    <div className="text-sm font-mono text-[var(--primary)] mb-1">
                                        {tier.allowance} Renders Included
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        {tier.onboardingFee > 0
                                            ? `+ $${tier.onboardingFee} one-time setup fee`
                                            : 'No setup fee'}
                                    </div>
                                </div>

                                <ul className="space-y-3 mb-8 text-sm text-gray-400 flex-1">
                                    {tier.features.slice(0, 4).map((feat, i) => (
                                        <li key={i} className="flex gap-2 items-start">
                                            <Check size={16} className={`shrink-0 ${tier.popular ? 'text-[var(--primary)]' : 'text-gray-500'}`} />
                                            <span>{feat}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Link
                                    href="/pricing"
                                    className={`block w-full py-3 rounded-xl text-center font-bold transition-all ${tier.popular
                                        ? 'bg-[var(--primary)] text-black hover:bg-white'
                                        : 'bg-white/5 text-white hover:bg-white/10'
                                        }`}
                                >
                                    View Details
                                </Link>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>
            </div>

            <div className="mt-8 text-center">
                <Link href="/pricing" className="text-[var(--primary)] hover:text-white transition-colors text-sm font-mono uppercase tracking-widest inline-flex items-center gap-2">
                    Compare All Features <ChevronRight size={14} />
                </Link>
            </div>
        </div>
    );
}
