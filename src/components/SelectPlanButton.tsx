'use client';

import { useState } from 'react';
import { createCheckoutSession } from '@/app/actions/stripe';
import { TierName } from '@/config/pricing';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SelectPlanButtonProps {
    tierName: TierName;
    popular?: boolean;
    className?: string; // Allow overriding base styles
}

export default function SelectPlanButton({ tierName, popular, className }: SelectPlanButtonProps) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleCheckout = async () => {
        setLoading(true);
        try {
            await createCheckoutSession(tierName);
        } catch (error: any) {
            console.error('Checkout error:', error);
            // If error implies not logged in, redirect
            // Since server action throws, we catch here. 
            // Ideally we'd distinguish errors, but for now assume auth error -> login
            // Or better: check for specific error message
            if (error.message?.includes('User not logged in') || error.message?.includes('fetch user profile')) {
                router.push(`/login?redirect=/pricing`); // Or signup
            } else {
                alert('Something went wrong. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleCheckout}
            disabled={loading}
            className={className || `
                block w-full py-4 text-center font-mono font-bold uppercase tracking-wider rounded transition-all
                ${popular
                    ? 'bg-[var(--primary)] text-black hover:bg-white hover:shadow-[0_0_20px_rgba(255,255,255,0.4)]'
                    : 'bg-white/10 text-white hover:bg-white hover:text-black'
                }
            `}
        >
            {loading ? (
                <span className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={20} />
                    Processing...
                </span>
            ) : (
                'Select Plan'
            )}
        </button>
    );
}
