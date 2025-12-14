'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowRight, Check, Upload, Palette, Lock } from 'lucide-react';
import { uploadLogo, updateProfile } from '@/app/actions';

function OnboardingContent() {
    const searchParams = useSearchParams();
    const shouldSkipPassword = searchParams.get('skip_password') === 'true';

    const [step, setStep] = useState(shouldSkipPassword ? 2 : 1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // Step 1: Password
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Step 2: Branding
    const [shopName, setShopName] = useState('');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Step 3: Styling
    const [primaryColor, setPrimaryColor] = useState('#7C3AED'); // Default Violet

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: password });
            if (error) throw error;
            setStep(2);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBrandingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // 1. Upload Logo if present
            if (logoFile) {
                const formData = new FormData();
                formData.append('file', logoFile);
                const res = await uploadLogo(formData);
                if (res.error) throw new Error(res.error);
            }

            // 2. Update Profile Name
            if (shopName) {
                const formData = new FormData();
                formData.append('shop_name', shopName);
                const res = await updateProfile(formData);
                if (res.error) throw new Error(res.error);
            }

            setStep(3);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStylingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('primary_color', primaryColor);

            const res = await updateProfile(formData);
            if (res.error) throw new Error(res.error);

            // DONE!
            router.push('/dashboard/leads');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setLogoFile(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
            <div className="w-full max-w-lg">
                {/* Progress */}
                <div className="flex justify-between mb-8 px-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex flex-col items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= i ? 'bg-primary text-white' : 'bg-zinc-800 text-gray-500'
                                }`}>
                                {step > i ? <Check size={14} /> : i}
                            </div>
                            <span className="text-[10px] uppercase font-mono tracking-widest text-gray-500">
                                {i === 1 ? 'Security' : i === 2 ? 'Identity' : 'Style'}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="bg-[#111] border border-gray-800 rounded-2xl p-8 shadow-2xl">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <div className="text-center mb-6">
                                    <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                                        <Lock size={20} />
                                    </div>
                                    <h2 className="text-2xl font-bold mb-2">Secure Account</h2>
                                    <p className="text-gray-400 text-sm">Set a permanent password for your login.</p>
                                </div>
                                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-mono text-gray-500 mb-1 uppercase">New Password</label>
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-black border border-gray-700 p-3 rounded-lg focus:outline-none focus:border-primary transition-colors"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-mono text-gray-500 mb-1 uppercase">Confirm Password</label>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full bg-black border border-gray-700 p-3 rounded-lg focus:outline-none focus:border-primary transition-colors"
                                            required
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : <>Continue <ArrowRight size={16} /></>}
                                    </button>
                                </form>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <div className="text-center mb-6">
                                    <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                                        <Upload size={20} />
                                    </div>
                                    <h2 className="text-2xl font-bold mb-2">Brand Identity</h2>
                                    <p className="text-gray-400 text-sm">Upload your shop logo and set your name.</p>
                                </div>
                                <form onSubmit={handleBrandingSubmit} className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-mono text-gray-500 mb-1 uppercase">Shop Name</label>
                                        <input
                                            type="text"
                                            value={shopName}
                                            onChange={(e) => setShopName(e.target.value)}
                                            className="w-full bg-black border border-gray-700 p-3 rounded-lg focus:outline-none focus:border-primary transition-colors"
                                            placeholder="e.g. Acme Ironworks"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-mono text-gray-500 mb-2 uppercase">Brand Logo</label>
                                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-700 border-dashed rounded-lg cursor-pointer hover:bg-zinc-900 transition-colors relative overflow-hidden group">
                                            {previewUrl ? (
                                                <img src={previewUrl} alt="Preview" className="h-full object-contain p-2" />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-gray-500 group-hover:text-gray-300">
                                                    <Upload size={24} className="mb-2" />
                                                    <p className="text-xs">Click to upload</p>
                                                </div>
                                            )}
                                            <input type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                                        </label>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : <>Continue <ArrowRight size={16} /></>}
                                    </button>
                                </form>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <div className="text-center mb-6">
                                    <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                                        <Palette size={20} />
                                    </div>
                                    <h2 className="text-2xl font-bold mb-2">Your Look</h2>
                                    <p className="text-gray-400 text-sm">Choose a primary color for your customer dashboard.</p>
                                </div>
                                <form onSubmit={handleStylingSubmit} className="space-y-8">

                                    <div className="flex flex-col items-center gap-4">
                                        <input
                                            type="color"
                                            value={primaryColor}
                                            onChange={(e) => setPrimaryColor(e.target.value)}
                                            className="w-20 h-20 bg-transparent cursor-pointer rounded-full overflow-hidden border-4 border-gray-700"
                                        />
                                        <span className="font-mono text-xl">{primaryColor}</span>
                                    </div>

                                    {/* Preview Card */}
                                    <div className="bg-zinc-900 p-4 rounded-lg border border-gray-800 opacity-80 pointer-events-none select-none transform scale-95">
                                        <div className="text-xs text-gray-500 mb-2 uppercase font-mono">Customer Button Preview</div>
                                        <div style={{ backgroundColor: primaryColor }} className="px-4 py-2 rounded text-black font-bold text-center">
                                            Request Quote
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : <>Finish Setup <Check size={16} /></>}
                                    </button>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {error && (
                        <div className="mt-4 p-3 bg-red-900/20 border border-red-900/50 rounded text-red-200 text-sm text-center">
                            {error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function OnboardingPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">Loading...</div>}>
            <OnboardingContent />
        </Suspense>
    );
}
