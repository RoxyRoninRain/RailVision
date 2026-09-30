'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { requestPasswordReset } from '@/app/actions/auth';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isForgotMode, setIsForgotMode] = useState(false);
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotSuccess, setForgotSuccess] = useState(false);
    const router = useRouter();

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                console.error('[LOGIN] SignIn Error:', error);
                setError(error.message);
            } else {
                console.log('[LOGIN] SignIn Success. Checking user role...');

                // Client-side redirect logic to avoid Server Action cookie delays
                const { data: { user } } = await supabase.auth.getUser();

                if (user?.email && ['admin@railify.com', 'me@railify.com', 'john@railify.com'].includes(user.email)) {
                    console.log('[LOGIN] Redirecting to Admin Dashboard');
                    router.push('/admin/stats');
                } else {
                    console.log('[LOGIN] Redirecting to Shop Dashboard');
                    router.push('/dashboard/leads');
                }

                router.refresh(); // Ensure server components update with new session
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            setError('Please enter your email address.');
            return;
        }

        setForgotLoading(true);
        setError(null);
        setForgotSuccess(false);

        try {
            const res = await requestPasswordReset(email.trim());
            if (res.error) throw new Error(res.error);
            setForgotSuccess(true);
        } catch (err: any) {
            setError(err.message || 'Failed to send recovery email.');
        } finally {
            setForgotLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-[var(--primary)]/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-[var(--secondary)]/10 rounded-full blur-[100px]" />
            </div>

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black uppercase tracking-tighter text-[var(--primary)] mb-2">Railify</h1>
                    <p className="text-gray-500 font-mono text-sm tracking-widest">
                        {isForgotMode ? 'PASSWORD RECOVERY' : 'AUTHORIZED ACCESS ONLY'}
                    </p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#111] border border-gray-800 p-8 rounded-xl shadow-2xl backdrop-blur-sm"
                >
                    {isForgotMode ? (
                        /* FORGOT PASSWORD FORM */
                        <form onSubmit={handleForgotPassword} className="space-y-6">
                            <div className="text-center mb-4">
                                <h2 className="text-xl font-bold text-white mb-1">Reset Your Password</h2>
                                <p className="text-gray-400 text-xs">
                                    Enter your account email to receive a password reset link.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-gray-400 mb-1 uppercase">Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[var(--primary)] transition-colors w-5 h-5" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-black/50 border border-gray-700 text-white pl-12 pr-4 py-3 rounded-lg focus:outline-none focus:border-[var(--primary)] transition-all placeholder:text-gray-700 text-sm"
                                        placeholder="tenant@railify.com"
                                        required
                                    />
                                </div>
                            </div>

                            <AnimatePresence>
                                {forgotSuccess && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="bg-emerald-950/40 border border-emerald-800/60 p-3 rounded text-emerald-300 text-xs font-mono"
                                    >
                                        Recovery link sent! Please check your email inbox to choose a new password.
                                    </motion.div>
                                )}
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="bg-red-900/20 border border-red-900/50 p-3 rounded flex items-center gap-3 text-red-200 text-sm"
                                    >
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        {error}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <button
                                type="submit"
                                disabled={forgotLoading}
                                className="w-full btn-primary flex items-center justify-center gap-2 group text-sm"
                            >
                                {forgotLoading ? (
                                    <Loader2 className="animate-spin w-5 h-5" />
                                ) : (
                                    <>
                                        Send Recovery Link <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>

                            <div className="text-center pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsForgotMode(false);
                                        setError(null);
                                        setForgotSuccess(false);
                                    }}
                                    className="text-xs font-mono text-gray-400 hover:text-white transition-colors"
                                >
                                    &larr; Return to Sign In
                                </button>
                            </div>
                        </form>
                    ) : (
                        /* LOGIN FORM */
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-mono text-gray-400 mb-1 uppercase">Email Address</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[var(--primary)] transition-colors w-5 h-5" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-black/50 border border-gray-700 text-white pl-12 pr-4 py-3 rounded-lg focus:outline-none focus:border-[var(--primary)] transition-all placeholder:text-gray-700"
                                            placeholder="admin@railify.com"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-mono text-gray-400 uppercase">Password</label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsForgotMode(true);
                                                setError(null);
                                                setForgotSuccess(false);
                                            }}
                                            className="text-[11px] font-mono text-[var(--primary)] hover:underline"
                                        >
                                            Forgot password?
                                        </button>
                                    </div>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[var(--primary)] transition-colors w-5 h-5" />
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-black/50 border border-gray-700 text-white pl-12 pr-4 py-3 rounded-lg focus:outline-none focus:border-[var(--primary)] transition-all placeholder:text-gray-700"
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="bg-red-900/20 border border-red-900/50 p-3 rounded flex items-center gap-3 text-red-200 text-sm"
                                    >
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        {error}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full btn-primary flex items-center justify-center gap-2 group"
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin w-5 h-5" />
                                ) : (
                                    <>
                                        AuthenticatE <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </motion.div>

                <div className="mt-8 text-center">
                    <p className="text-gray-600 text-xs">
                        &copy; 2025 Mississippi Metal Magic. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    );
}
