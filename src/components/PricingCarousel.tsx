'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import Link from 'next/link';
import { PRICING_TIERS, PricingTier } from '@/config/pricing';


export default function PricingCarousel() {
    // Convert object to array for easier mapping
    const tiers = Object.values(PRICING_TIERS).filter(tier => tier.name !== 'The Unlimited');

    return (
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {tiers.map((tier, idx) => (
                    <div
                        key={tier.name}
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
                                {tier.allowance > 0 ? `${tier.allowance} Renders Included` : `$${tier.overageRate.toFixed(2)} per image`}
                            </div>
                            <div className="text-xs text-gray-400">
                                {tier.onboardingFee > 0
                                    ? 'One-time Setup Fee'
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
                            See Details
                        </Link>
                    </div>
                ))}
            </div>

            <div className="mt-8 text-center">
                <Link href="/pricing" className="text-[var(--primary)] hover:text-white transition-colors text-sm font-mono uppercase tracking-widest inline-flex items-center gap-2">
                    Compare All Features <ChevronRight size={14} />
                </Link>
            </div>
        </div>
    );
}
