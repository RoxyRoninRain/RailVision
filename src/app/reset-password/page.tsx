'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, CheckCircle2, AlertCircle, ArrowRight, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);
    const [hasSession, setHasSession] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        const verifyAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setHasSession(true);
                setCheckingSession(false);
                return;
            }

            // Listen for state change in case hash tokens are being processed
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                if (session) {
                    setHasSession(true);
                }
                setCheckingSession(false);
            });

            // Small fallback timeout to stop loading if no session event arrives
            const timer = setTimeout(() => {
                setCheckingSession(false);
            }, 2500);

            return () => {
                subscription.unsubscribe();
                clearTimeout(timer);
            };
        };

        verifyAuth();
    }, [supabase]);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password,
            });

            if (updateError) {
                throw updateError;
            }

            setSuccess(true);
        } catch (err: any) {
            console.error('Password reset error:', err);
            setError(err.message || 'Failed to update password. Your session may have expired.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-sans">
            {/* Background Ambience */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-[var(--primary)]/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[100px]" />
            </div>

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black uppercase tracking-tighter text-[var(--primary)] mb-2">
                        Railify
                    </h1>
                    <p className="text-gray-500 font-mono text-xs tracking-widest uppercase">
                        Account Security & Recovery
                    </p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#111] border border-gray-800 p-8 rounded-2xl shadow-2xl backdrop-blur-sm"
                >
                    {checkingSession ? (
                        <div className="py-12 text-center text-gray-400 flex flex-col items-center gap-3">
                            <Loader2 className="animate-spin text-[var(--primary)] w-8 h-8" />
                            <span className="font-mono text-sm tracking-wide">Validating recovery session...</span>
                        </div>
                    ) : success ? (
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-center py-4 space-y-5"
                        >
                            <div className="w-16 h-16 bg-emerald-950/50 border border-emerald-800/60 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                                <CheckCircle2 size={32} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2">Password Updated</h2>
                                <p className="text-sm text-gray-400">
                                    Your password has been securely changed. You can now access your account with your new credentials.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    router.push('/dashboard/leads');
                                    router.refresh();
                                }}
                                className="w-full bg-[var(--primary)] text-white font-bold py-3 rounded-lg hover:brightness-110 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                            >
                                Continue to Dashboard <ArrowRight size={16} />
                            </button>
                        </motion.div>
                    ) : !hasSession ? (
                        <div className="text-center py-4 space-y-5">
                            <div className="w-16 h-16 bg-red-950/40 border border-red-900/60 rounded-full flex items-center justify-center mx-auto text-red-400">
                                <AlertCircle size={32} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2">Expired or Invalid Link</h2>
                                <p className="text-sm text-gray-400">
                                    This password recovery link is expired or has already been used. Please ask your administrator for a new reset link or request one from the login page.
                                </p>
                            </div>
                            <Link
                                href="/login"
                                className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-mono text-xs uppercase font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                Return to Login
                            </Link>
                        </div>
                    ) : (
                        <div>
                            <div className="text-center mb-6">
                                <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-3 text-[var(--primary)] border border-zinc-800">
                                    <ShieldCheck size={22} />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-1">Set New Password</h2>
                                <p className="text-gray-400 text-xs font-mono">
                                    Choose a strong password to secure your account.
                                </p>
                            </div>

                            <form onSubmit={handleResetPassword} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-mono text-gray-400 mb-1 uppercase tracking-wider">
                                        New Password
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-black/60 border border-gray-700 text-white pl-10 pr-10 py-2.5 rounded-lg focus:outline-none focus:border-[var(--primary)] transition-colors text-sm placeholder:text-gray-700"
                                            placeholder="At least 6 characters"
                                            required
                                            minLength={6}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-mono text-gray-400 mb-1 uppercase tracking-wider">
                                        Confirm New Password
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full bg-black/60 border border-gray-700 text-white pl-10 pr-10 py-2.5 rounded-lg focus:outline-none focus:border-[var(--primary)] transition-colors text-sm placeholder:text-gray-700"
                                            placeholder="Re-enter new password"
                                            required
                                            minLength={6}
                                        />
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="bg-red-950/40 border border-red-900/60 p-3 rounded-lg flex items-center gap-2.5 text-red-200 text-xs font-mono"
                                        >
                                            <AlertCircle size={15} className="shrink-0 text-red-400" />
                                            <span>{error}</span>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-[var(--primary)] hover:brightness-110 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider font-mono shadow-lg disabled:opacity-50"
                                >
                                    {loading ? (
                                        <Loader2 className="animate-spin w-4 h-4" />
                                    ) : (
                                        <>
                                            Update Password <ArrowRight size={15} />
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    )}
                </motion.div>

                <div className="mt-8 text-center">
                    <p className="text-gray-600 text-xs font-mono">
                        Railify &bull; Mississippi Metal Magic
                    </p>
                </div>
            </div>
        </div>
    );
}
