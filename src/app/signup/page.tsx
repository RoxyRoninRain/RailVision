'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Loader2, ArrowRight, CreditCard, ShieldCheck, Check, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { updateProfile } from '@/app/actions';
import { createCheckoutSession } from '@/app/actions/stripe';

function SignupContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const plan = searchParams.get('plan') || 'pro';

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [businessName, setBusinessName] = useState('');
    const [phone, setPhone] = useState('');

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // 1. Sign Up
            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                    },
                },
            });

            if (signUpError) throw signUpError;

            if (data.user) {
                // 2. Update Profile with Business Info
                // We construct FormData as expected by updateProfile action
                const formData = new FormData();
                formData.append('shop_name', businessName);
                if (phone) formData.append('phone', phone);

                // We need to wait a moment for the session to propagate? 
                // Usually client-side auth state update is immediate, but server action needs cookie.
                // Let's try calling it. If it fails, we might need a distinct onboarding step.

                // Import dynamically to avoid server-client issues? No, it's imported at top.
                // updateProfile is a Server Action.
                const profileRes = await updateProfile(formData);

                if (profileRes.error) {
                    // Log but don't block? Or block?
                    console.error('Profile update failed:', profileRes.error);
                }

                // 3. Create Checkout Session
                // This redirects the user to Stripe
                await createCheckoutSession(plan as any);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'An unexpected error occurred');
            setLoading(false);
        }
    };

    const getPlanName = (p: string) => {
        if (p === 'starter') return 'Starter';
        if (p === 'agency') return 'Agency';
        return 'Professional';
    };

    const getPlanPrice = (p: string) => {
        if (p === 'starter') return '$49';
        if (p === 'agency') return '$249';
        return '$99';
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col md:flex-row">

            {/* Left Column: Context/Branding */}
            <div className="hidden md:flex flex-col justify-between w-1/3 bg-[#0a0a0a] border-r border-white/5 p-12">
                <div>
                    <div className="flex items-center gap-2 mb-12">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-xl">R</div>
                        <span className="font-bold text-xl">Railify</span>
                    </div>

                    <h2 className="text-3xl font-bold mb-6">Join the top fabricators using AI to close deals.</h2>

                    <div className="space-y-6">
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                                <Check size={16} />
                            </div>
                            <div>
                                <h4 className="font-bold text-white">Instant Setup</h4>
                                <p className="text-sm text-gray-500">Get your visualizer live in minutes.</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                                <Check size={16} />
                            </div>
                            <div>
                                <h4 className="font-bold text-white">Cancel Anytime</h4>
                                <p className="text-sm text-gray-500">No long-term contracts. Monthly flexibility.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-[#111] p-6 rounded-xl border border-white/5">
                    <div className="flex gap-1 text-yellow-500 mb-2">
                        {"★★★★★"}
                    </div>
                    <p className="text-gray-300 italic mb-4">"This tool paid for itself in the first week. My customers love seeing the designs instantly."</p>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-700 rounded-full" />
                        <div className="text-sm">
                            <div className="font-bold">Mike S.</div>
                            <div className="text-gray-500">Ironworks Co.</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Form */}
            <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="w-full max-w-md">
                    <h1 className="text-2xl font-bold mb-2">
                        Create your account
                    </h1>
                    <p className="text-gray-400 mb-8">
                        Selected Plan: <span className="text-white font-medium">{getPlanName(plan)} ({getPlanPrice(plan)}/mo)</span>
                    </p>

                    <form onSubmit={handleSignup} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-mono text-gray-500 mb-1 uppercase">Full Name</label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full bg-black/50 border border-gray-700 p-3 rounded-lg focus:outline-none focus:border-primary transition-colors"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-mono text-gray-500 mb-1 uppercase">Business Name</label>
                                <input
                                    type="text"
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    className="w-full bg-black/50 border border-gray-700 p-3 rounded-lg focus:outline-none focus:border-primary transition-colors"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-mono text-gray-500 mb-1 uppercase">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-black/50 border border-gray-700 p-3 rounded-lg focus:outline-none focus:border-primary transition-colors"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-mono text-gray-500 mb-1 uppercase">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-black/50 border border-gray-700 p-3 rounded-lg focus:outline-none focus:border-primary transition-colors"
                                required
                            />
                        </div>

                        {error && (
                            <div className="text-red-400 text-sm bg-red-900/20 p-2 rounded border border-red-900/50">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <>Continue to Payment <ArrowRight size={16} /></>}
                        </button>

                        <p className="text-xs text-center text-gray-500 mt-4">
                            You will be redirected to Stripe to complete your subscription.
                        </p>
                    </form>

                </div>
            </div>
        </div>
    );
}

export default function SignupPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>}>
            <SignupContent />
        </Suspense>
    );
}
