'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Download, Check } from 'lucide-react';

interface DownloadGateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { name: string; email: string }) => Promise<void>;
}

export function DownloadGateModal({ isOpen, onClose, onSubmit }: DownloadGateModalProps) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSubmit({ name, email });
            setSuccess(true);
            // Close after brief success State
            setTimeout(() => {
                setSuccess(false);
                onClose();
            }, 1000);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="bg-[#111] border border-[#333] p-8 rounded-2xl max-w-md w-full relative shadow-2xl overflow-hidden"
                    >
                        {/* Decorative Gradient Blob */}
                        <div className="absolute -top-20 -right-20 w-64 h-64 bg-[var(--primary)] rounded-full blur-[100px] opacity-10 pointer-events-none" />

                        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-10">
                            <X size={20} />
                        </button>

                        <div className="text-center mb-8 relative z-10">
                            <div className="w-16 h-16 bg-[var(--primary)]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[var(--primary)]/20">
                                <Lock className="w-8 h-8 text-[var(--primary)]" />
                            </div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">
                                Unlock Download
                            </h2>
                            <p className="text-gray-400 text-sm">
                                Enter your details to download your high-resolution design rendering.
                            </p>
                        </div>

                        {success ? (
                            <div className="bg-green-900/20 border border-green-900/50 rounded-lg p-8 text-center animate-in fade-in zoom-in duration-300">
                                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500">
                                    <Check size={32} />
                                </div>
                                <p className="font-bold text-green-400 uppercase tracking-widest">Unlocked!</p>
                                <p className="text-xs text-green-600/80 mt-1">Starting download...</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
                                <div className="space-y-2">
                                    <label className="text-xs font-mono text-gray-500 uppercase font-bold ml-1">Your Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-[#050505] border border-[#333] p-3 rounded-lg text-white focus:border-[var(--primary)] outline-none transition-all focus:shadow-[0_0_15px_-5px_var(--primary)]"
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-mono text-gray-500 uppercase font-bold ml-1">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-[#050505] border border-[#333] p-3 rounded-lg text-white focus:border-[var(--primary)] outline-none transition-all focus:shadow-[0_0_15px_-5px_var(--primary)]"
                                        placeholder="john@example.com"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 bg-[var(--primary)] text-black font-black uppercase tracking-widest rounded-lg hover:brightness-110 transition-all shadow-[0_0_20px_-5px_var(--primary)] flex items-center justify-center gap-2 mt-6 group"
                                >
                                    {loading ? (
                                        <span className="flex items-center gap-2">Processing...</span>
                                    ) : (
                                        <>
                                            Access Design <Download size={18} className="group-hover:translate-y-1 transition-transform" />
                                        </>
                                    )}
                                </button>
                                <p className="text-[10px] text-gray-600 text-center mt-4">
                                    We respect your privacy. No spam.
                                </p>
                            </form>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
