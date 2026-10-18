import type { Metadata } from 'next';
import { PRICING_TIERS } from '@/config/pricing';
import { Check } from 'lucide-react';
import Navbar from '@/components/Navbar';
import SelectPlanButton from '@/components/SelectPlanButton';

export const metadata: Metadata = {
    title: 'Pricing & Plans — White-Label AI Handrail Visualizer',
    description:
        'Transparent, performance-based pricing for custom handrail fabricators and railing contractors. Plans start at $20/mo with white-label embedding, instant quote estimation, and configurable spending caps.',
    alternates: {
        canonical: 'https://railify.app/pricing',
    },
};

const PRICING_FAQS = [
    {
        question: 'How does billing work?',
        answer:
            "You pay a small monthly platform fee to access the tools. Then, you simply pay for each image you generate at your plan's rate.",
    },
    {
        question: 'Can I control my spending?',
        answer:
            'Absolutely. You can set a "Safety Cap" in your settings. We will automatically stop generation if you hit your monthly budget limit.',
    },
    {
        question: 'What is the Onboarding Fee for?',
        answer:
            'This one-time fee covers the manual setup of your white-labeled tool, uploading your logo, and calibrating the AI to your specific styles.',
    },
    {
        question: 'Can I switch plans?',
        answer:
            'Yes, you can upgrade or downgrade at any time. If your volume increases, moving to a higher tier will lower your per-image cost significantly.',
    },
];

const pricingJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: PRICING_FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
        },
    })),
};

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-[var(--primary)] selection:text-black">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
            />
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 py-24">
                <div className="text-center mb-16">
                    <h1 className="text-5xl md:text-7xl font-bold font-mono uppercase tracking-tighter mb-6 text-[var(--primary)]">
                        Performance Pricing
                    </h1>
                    <p className="text-xl text-gray-500 max-w-2xl mx-auto">
                        Stop paying for idle software. Our metered plans let you pay a low base fee, plus a small cost per render. Scale up or down instantly.
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
                                    Best Value
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
                                        <span className="text-sm text-gray-400">Rate</span>
                                        <span className="text-[var(--primary)] font-bold">
                                            ${tier.overageRate.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 font-mono">
                                        Per image generated
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
                                        One-time setup & training
                                    </div>
                                </div>

                                {tier.signupBonusCredits && (
                                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-emerald-300 text-xs font-mono flex items-center justify-between">
                                        <span className="font-semibold">🎁 1st-Time Perk:</span>
                                        <span className="font-bold text-white bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
                                            +{tier.signupBonusCredits} Free Credits
                                        </span>
                                    </div>
                                )}

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
                        ⚡ Start small, upgrade as you grow. No contracts.
                    </p>
                </div>

                <div className="mt-24 text-center border-t border-gray-900 pt-16">
                    <h2 className="text-2xl font-mono font-bold text-white mb-8">Frequently Asked Questions</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left max-w-4xl mx-auto">
                        {PRICING_FAQS.map((faq, idx) => (
                            <div key={idx}>
                                <h3 className="text-[var(--primary)] font-bold mb-2">{faq.question}</h3>
                                <p className="text-gray-500 text-sm">{faq.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
