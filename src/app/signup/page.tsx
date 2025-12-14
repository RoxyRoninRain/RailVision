'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Loader2, ArrowRight, CreditCard, ShieldCheck, Check, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

function SignupContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const plan = searchParams.get('plan') || 'pro';

    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Billing (Mock), 2: Account
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const handleBillingSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        // Mock API call delay
        setTimeout(() => {
            setLoading(false);
            setStep(2);
        }, 1000);
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) throw error;

            if (data.user) {
                // Determine if we need to verify email or if session is active
                // For this demo, assuming standard flow. If auto-confirm is on, session exists.
                // We redirect to onboarding immediately.
                if (data.session) {
                    router.push('/onboarding?skip_password=true');
                } else {
                    // Email confirmation case
                    router.push('/onboarding?check_email=true');
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
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
                    {/* Progress Steps */}
                    <div className="flex items-center gap-4 mb-8 text-sm">
                        <div className={`flex items-center gap-2 ${step === 1 ? 'text-primary font-bold' : 'text-gray-500'}`}>
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${step === 1 ? 'border-primary bg-primary/10' : 'border-gray-700'}`}>1</span>
                            Billing
                        </div>
                        <div className="h-[1px] w-8 bg-gray-800" />
                        <div className={`flex items-center gap-2 ${step === 2 ? 'text-primary font-bold' : 'text-gray-500'}`}>
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${step === 2 ? 'border-primary bg-primary/10' : 'border-gray-700'}`}>2</span>
                            Account
                        </div>
                    </div>

                    <h1 className="text-2xl font-bold mb-2">
                        {step === 1 ? 'Activate your subscription' : 'Create your secure login'}
                    </h1>
                    <p className="text-gray-400 mb-8">
                        Selected Plan: <span className="text-white font-medium">{getPlanName(plan)} ({getPlanPrice(plan)}/mo)</span>
                    </p>

                    {/* Step 1: Billing (Mock) */}
                    {step === 1 && (
                        <motion.form
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            onSubmit={handleBillingSubmit} className="space-y-6"
                        >
                            <div className="p-4 bg-[#111] border border-gray-800 rounded-lg flex items-center gap-4">
                                <ShieldCheck className="text-primary" />
                                <div className="text-sm text-gray-400">
                                    This is a secure 256-bit SSL encrypted payment.
                                    <br /><span className="text-xs opacity-50">(Mock: No charge will be made)</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-gray-500 mb-1 uppercase">Card Information</label>
                                <div className="bg-black/50 border border-gray-700 rounded-lg p-3 flex items-center gap-3">
                                    <CreditCard className="text-gray-500" size={20} />
                                    <input type="text" placeholder="0000 0000 0000 0000" className="bg-transparent outline-none w-full" disabled />
                                    <div className="flex gap-2 opacity-50">
                                        <div className="w-8 h-5 bg-gray-700 rounded" />
                                        <div className="w-8 h-5 bg-gray-700 rounded" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <input type="text" placeholder="MM / YY" className="w-full bg-black/50 border border-gray-700 p-3 rounded-lg outline-none" disabled />
                                    </div>
                                    <div>
                                        <input type="text" placeholder="CVC" className="w-full bg-black/50 border border-gray-700 p-3 rounded-lg outline-none" disabled />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : <>Continue to Account <ArrowRight size={16} /></>}
                            </button>
                        </motion.form>
                    )}

                    {/* Step 2: Signup */}
                    {step === 2 && (
                        <motion.form
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            onSubmit={handleSignup} className="space-y-4"
                        >
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
                            <div>
                                <label className="block text-xs font-mono text-gray-500 mb-1 uppercase">Confirm Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                                {loading ? <Loader2 className="animate-spin" /> : 'Create Account & Start Trial'}
                            </button>

                            <p className="text-xs text-center text-gray-500 mt-4">
                                By clicking above, you agree to our Terms of Service.
                            </p>
                        </motion.form>
                    )}

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
