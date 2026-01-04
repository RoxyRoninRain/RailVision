import { PRICING_TIERS } from '@/config/pricing';
import { Check, Info } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import SelectPlanButton from '@/components/SelectPlanButton';

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-[var(--primary)] selection:text-black">
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 py-24">
                <div className="text-center mb-16">
                    <h1 className="text-5xl md:text-7xl font-bold font-mono uppercase tracking-tighter mb-6 text-[var(--primary)]">
                        Utility Pricing
                    </h1>
                    <p className="text-xl text-gray-500 max-w-2xl mx-auto">
                        Pay for power, not promises. Base utility plans with optional Overdrive™ for unlimited scalability.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                    {Object.values(PRICING_TIERS).filter(t => t.name !== 'The Unlimited').map((tier) => (
                        <div
                            key={tier.name}
                            className={`
                                relative p-6 rounded-lg border flex flex-col
                                ${tier.popular
                                    ? 'border-[var(--primary)] bg-[#111] shadow-[0_0_30px_rgba(var(--primary-rgb),0.2)] scale-105 z-10'
                                    : 'border-gray-800 bg-[#050505] hover:border-gray-600'
                                }
                            `}
                        >
                            {tier.popular && (
                                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-[var(--primary)] text-black font-bold font-mono text-xs uppercase px-4 py-1 rounded-full">
                                    Most Popular
                                </div>
                            )}

                            <div className="mb-6">
                                <h3 className="text-lg font-mono font-bold uppercase tracking-wider text-white">
                                    {tier.name}
                                </h3>
                                <div className="mt-4 flex items-baseline gap-1">
                                    <span className="text-4xl font-bold text-white">${tier.price}</span>
                                    <span className="text-sm text-gray-500 font-mono">/mo</span>
                                </div>
                            </div>

                            <div className="space-y-4 mb-8 flex-grow">
                                <div className="p-4 bg-white/5 rounded border border-white/10">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm text-gray-400">Allowance</span>
                                        <span className="text-white font-bold">
                                            {tier.allowance > 0 ? `${tier.allowance} Renders` : 'Pay As You Go'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 font-mono">
                                        {tier.allowance > 0 ? 'Included monthly' : 'No monthly limits'}
                                    </div>
                                </div>

                                <div className="p-4 bg-white/5 rounded border border-white/10">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm text-gray-400">Overdrive™</span>
                                        <span className="text-[var(--primary)] font-bold">${tier.overageRate.toFixed(2)}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 font-mono">
                                        Per extra render
                                    </div>
                                </div>

                                <div className="p-4 bg-white/5 rounded border border-white/10">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm text-gray-400">Onboarding</span>
                                        <span className="text-white font-bold">
                                            {tier.onboardingFee === 0 ? 'Free' : `$${tier.onboardingFee}`}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 font-mono">
                                        {tier.onboardingFee === 0 ? 'Included setup' : 'One-time setup fee'}
                                    </div>
                                </div>

                                <ul className="space-y-3 pt-4 border-t border-gray-800">
                                    {tier.features.map((feature, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm text-gray-400">
                                            <Check size={16} className="text-[var(--primary)] shrink-0 mt-0.5" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div>
                                <SelectPlanButton
                                    tierName={tier.name}
                                    popular={tier.popular}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-8 text-center animate-pulse">
                    <p className="text-xs md:text-sm text-gray-500 font-mono bg-white/5 inline-block px-4 py-2 rounded-full border border-white/10">
                        ⚠️ Note: Pricing subject to change. Lock in your price today.
                    </p>
                </div>

                <div className="mt-24 text-center border-t border-gray-900 pt-16">
                    <h2 className="text-2xl font-mono font-bold text-white mb-8">Frequently Asked Questions</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left max-w-4xl mx-auto">
                        <div>
                            <h3 className="text-[var(--primary)] font-bold mb-2">What happens when I hit my limit?</h3>
                            <p className="text-gray-500 text-sm">
                                By default, generation is paused (Soft Cap). You can enable "Overdrive" in your dashboard to keep generating at your plan's overage rate.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-[var(--primary)] font-bold mb-2">Can I cap my spending?</h3>
                            <p className="text-gray-500 text-sm">
                                Yes. You can set a "Max Monthly Spend" limit in your dashboard to ensure you never exceed your budget, even with Overdrive enabled.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
