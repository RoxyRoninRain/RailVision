'use client';

import { useState, useEffect } from 'react';
import { InputSanitizer } from '@/components/security/InputSanitizer';
import { generateDesign, submitLead } from './actions';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Check, Loader2, ArrowRight, MousePointerClick, TrendingUp, AlertCircle, Quote } from 'lucide-react';
import clsx from 'clsx';

interface DesignStudioProps {
    styles: { id: string; name: string; description: string }[];
}

export default function DesignStudio({ styles }: DesignStudioProps) {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [selectedStyle, setSelectedStyle] = useState(styles[0]?.name || 'Industrial');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Lead Form
    const [email, setEmail] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [leadStatus, setLeadStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

    // Loading Simulation State
    const [loadingStep, setLoadingStep] = useState(0);
    const loadingSteps = [
        "Analyzing structural integrity...",
        "Mapping architectural geometry...",
        "Applying material textures...",
        "Rendering lighting & shadows...",
        "Finalizing high-res output..."
    ];

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (loading) {
            setLoadingStep(0);
            interval = setInterval(() => {
                setLoadingStep(prev => (prev + 1) % loadingSteps.length);
            }, 1500);
        }
        return () => clearInterval(interval);
    }, [loading]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            const validation = InputSanitizer.validate(selectedFile);
            if (!validation.valid) {
                setError(validation.error || 'Invalid file');
                return;
            }

            // Client-side resizing
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = document.createElement('img');
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_SIZE = 1200;

                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (blob) {
                            const newFile = new File([blob], selectedFile.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });
                            setFile(newFile);
                            setPreview(URL.createObjectURL(newFile));
                        }
                    }, 'image/jpeg', 0.8);
                };
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(selectedFile);
        }
    };

    const handleGenerate = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append('image', file);
        formData.append('style', selectedStyle);

        const res = await generateDesign(formData);

        if (res.error) {
            setError(res.error);
        } else {
            setResult(res.data ?? null);
            setStep(3);
        }
        setLoading(false);
    };

    const handleQuoteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLeadStatus('submitting');

        const formData = new FormData();
        formData.append('email', email);
        formData.append('customer_name', customerName);
        formData.append('style_name', selectedStyle);

        const res = await submitLead(formData);
        if (res.success) {
            setLeadStatus('success');
        } else {
            setLeadStatus('error');
        }
    };

    return (
        <main className="min-h-screen bg-[var(--background)] text-white p-6 md:p-12 pb-24 font-sans selection:bg-[var(--primary)] selection:text-black">
            <header className="mb-16 text-center">
                <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-4xl md:text-6xl text-[var(--primary)] mb-2 font-black tracking-tighter uppercase"
                >
                    Mississippi Metal Magic
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-sm md:text-xl text-gray-500 tracking-[0.3em] font-mono uppercase"
                >
                    Design Studio v3.0 // Vertex AI
                </motion.p>
            </header>

            {/* ERROR MESSAGE */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="bg-red-900/40 text-red-200 p-6 rounded-lg mb-8 border border-red-500/50 max-w-2xl mx-auto flex items-center gap-4"
                    >
                        <AlertCircle className="w-6 h-6 shrink-0" />
                        <p>{error}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* PROGRESS INDICATOR */}
            <div className="max-w-4xl mx-auto mb-12 flex items-center justify-between text-xs md:text-sm font-mono tracking-widest text-gray-600">
                <div className={clsx("flex items-center gap-2", step >= 1 ? "text-[var(--primary)]" : "")}>
                    <span className="border border-current w-6 h-6 flex items-center justify-center rounded-full">1</span> UPLOAD
                </div>
                <div className="h-px bg-gray-800 flex-1 mx-4" />
                <div className={clsx("flex items-center gap-2", step >= 2 ? "text-[var(--primary)]" : "")}>
                    <span className="border border-current w-6 h-6 flex items-center justify-center rounded-full">2</span> CUSTOMIZE
                </div>
                <div className="h-px bg-gray-800 flex-1 mx-4" />
                <div className={clsx("flex items-center gap-2", step >= 3 ? "text-[var(--primary)]" : "")}>
                    <span className="border border-current w-6 h-6 flex items-center justify-center rounded-full">3</span> RESULT
                </div>
            </div>

            {/* STEP 1: UPLOAD */}
            {step === 1 && (
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-xl mx-auto"
                >
                    <div className="border border-gray-800 p-1 rounded-xl bg-gradient-to-b from-[#1a1a1a] to-black">
                        <div className="border border-dashed border-gray-700 p-12 rounded-lg text-center cursor-pointer hover:border-[var(--primary)] hover:bg-[#111] transition-all group relative overflow-hidden">
                            <input
                                type="file"
                                onChange={handleFileChange}
                                className="absolute inset-0 opacity-0 z-10 cursor-pointer"
                                accept=".jpg,.jpeg,.png"
                            />

                            {preview ? (
                                <div className="relative z-0">
                                    <img src={preview} alt="Preview" className="max-h-[40vh] mx-auto rounded-lg shadow-2xl" />
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <p className="text-[var(--primary)] font-mono">CHANGE IMAGE</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="w-20 h-20 mx-auto bg-gray-900 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Upload className="w-8 h-8 text-[var(--primary)]" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Upload Your Space</h3>
                                        <p className="text-gray-500 mt-2">Drag & drop or click to browse</p>
                                    </div>
                                    <p className="text-xs text-gray-600 font-mono">JPG/PNG • MAX 1200px (Auto-Resized)</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        disabled={!file}
                        onClick={() => setStep(2)}
                        className="btn-primary w-full mt-8 flex items-center justify-center gap-2 group"
                    >
                        Next Step <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                </motion.section>
            )}

            {/* STEP 2: VISUALIZE */}
            {step === 2 && (
                <motion.section
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="max-w-6xl mx-auto"
                >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                        {/* Left: Preview */}
                        <div className="lg:col-span-4 space-y-6">
                            <div className="sticky top-8">
                                <h3 className="text-gray-500 font-mono text-xs uppercase mb-4 tracking-widest">Target Structure</h3>
                                <div className="relative rounded-xl overflow-hidden border border-[var(--secondary)]">
                                    {preview && <img src={preview} alt="Original" className="w-full opacity-80" />}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-6">
                                        <p className="text-white font-mono text-sm">ORIGINAL_CAPTURE.JPG</p>
                                    </div>
                                </div>

                                <div className="mt-8 p-6 bg-[#111] border border-gray-800 rounded-lg">
                                    <h4 className="text-[var(--primary)] mb-2 font-mono text-sm">System Ready</h4>
                                    <p className="text-gray-500 text-sm leading-relaxed">
                                        Our AI engine will analyze structural hardpoints and overlay the selected aesthetic while maintaining perspective geometry.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Right: Controls */}
                        <div className="lg:col-span-8">
                            <h2 className="text-3xl font-bold mb-8">Select Design Aesthetic</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                {styles.map((style) => (
                                    <div
                                        key={style.id}
                                        onClick={() => setSelectedStyle(style.name)}
                                        className={clsx(
                                            "relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-300 group overflow-hidden",
                                            selectedStyle === style.name
                                                ? "border-[var(--primary)] bg-[var(--primary)]/5 shadow-[0_0_30px_-10px_var(--primary)]"
                                                : "border-[var(--secondary)] hover:border-gray-500 bg-[#111]"
                                        )}
                                    >
                                        <div className="flex justify-between items-start mb-4 relative z-10">
                                            <h3 className={clsx("text-xl font-bold uppercase", selectedStyle === style.name ? "text-[var(--primary)]" : "text-white")}>
                                                {style.name}
                                            </h3>
                                            {selectedStyle === style.name && (
                                                <div className="bg-[var(--primary)] text-black rounded-full p-1">
                                                    <Check className="w-4 h-4" />
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-gray-400 text-sm leading-relaxed relative z-10">
                                            {style.description}
                                        </p>

                                        {/* Background decoration */}
                                        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-gradient-to-tl from-white/5 to-transparent rounded-full blur-2xl group-hover:from-white/10 transition-colors" />
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={loading}
                                className="w-full py-6 bg-[var(--primary)] text-black font-bold text-xl uppercase tracking-wider hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 rounded-lg"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        Generate Visualization <TrendingUp className="w-6 h-6" />
                                    </>
                                )}
                            </button>

                            {/* LOADING OVERLAY */}
                            <AnimatePresence>
                                {loading && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-8 backdrop-blur-sm"
                                    >
                                        <div className="w-full max-w-md text-center">
                                            <div className="mb-8 relative">
                                                <div className="w-24 h-24 border-4 border-[var(--secondary)] border-t-[var(--primary)] rounded-full animate-spin mx-auto" />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-16 h-16 bg-[var(--primary)]/20 rounded-full animate-pulse" />
                                                </div>
                                            </div>

                                            <h3 className="text-2xl font-bold text-white mb-2">Generating Concept</h3>
                                            <p className="text-[var(--primary)] font-mono h-6">
                                                {loadingSteps[loadingStep]}
                                            </p>

                                            <div className="mt-8 w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-[var(--primary)]"
                                                    initial={{ width: "0%" }}
                                                    animate={{ width: "100%" }}
                                                    transition={{ duration: 8, ease: "linear" }}
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </motion.section>
            )}

            {/* STEP 3: RESULT */}
            {step === 3 && (
                <motion.section
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="max-w-7xl mx-auto"
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
                        {/* VISUALS */}
                        <div className="space-y-4">
                            <div className="relative group">
                                <div className="absolute top-4 left-4 bg-black/80 backdrop-blur border border-white/20 text-white px-3 py-1 text-xs font-mono z-10 uppercase tracking-wider rounded">
                                    AI PROPOSAL // {selectedStyle}
                                </div>
                                {result ? (
                                    <div className="rounded-xl overflow-hidden border border-[var(--primary)]/30 shadow-2xl shadow-[var(--primary)]/10">
                                        <img src={result} alt="AI Generated Design" className="w-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="h-96 bg-gray-900 rounded-xl flex items-center justify-center">
                                        <p className="text-gray-500">Image failed to load</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-4 overflow-x-auto pb-2">
                                <div className="w-32 h-24 shrink-0 rounded-lg overflow-hidden border border-gray-700 opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
                                    <img src={preview!} alt="Original" className="w-full h-full object-cover grayscale" />
                                </div>
                                {/* Placeholders for potential variations */}
                            </div>
                        </div>

                        {/* ANALYSIS & ACTION */}
                        <div className="flex flex-col justify-center">
                            <div className="mb-12">
                                <h2 className="text-3xl md:text-4xl font-bold mb-6 text-[var(--primary)]">Architectural Analysis</h2>
                                <div className="space-y-6 text-gray-300 leading-relaxed font-light">
                                    <p>
                                        The generated concept applies the <strong className="text-white font-bold">{selectedStyle}</strong> aesthetic to your existing structural framework.
                                        Note the integration of distinct material textures and the emphasis on clean lines that complement the spatial volume.
                                    </p>
                                    <ul className="space-y-4 font-mono text-sm text-gray-400 border-l-2 border-[var(--secondary)] pl-6">
                                        <li className="flex items-center gap-3">
                                            <span className="w-2 h-2 bg-[var(--primary)] rounded-full" />
                                            Optimized for load-bearing efficiency
                                        </li>
                                        <li className="flex items-center gap-3">
                                            <span className="w-2 h-2 bg-[var(--primary)] rounded-full" />
                                            High-contrast material finish proposed
                                        </li>
                                        <li className="flex items-center gap-3">
                                            <span className="w-2 h-2 bg-[var(--primary)] rounded-full" />
                                            Compliance with modern safety standards
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <div className="bg-[#111] p-8 rounded-2xl border border-[var(--secondary)] relative overflow-hidden">
                                <div className="relative z-10">
                                    <h3 className="text-2xl font-bold text-white mb-2">Proceed to Engineering</h3>
                                    <p className="text-gray-500 mb-6">Unlock the full resolution blueprint and receive a detailed fabrication quote.</p>

                                    {leadStatus === 'success' ? (
                                        <motion.div
                                            initial={{ scale: 0.9, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="bg-green-900/20 border border-green-500/50 p-6 rounded-lg text-center text-green-400"
                                        >
                                            <Check className="w-12 h-12 mx-auto mb-2" />
                                            <p className="font-bold text-lg">Request Received</p>
                                            <p className="text-sm">Our engineering team will contact you shortly.</p>
                                        </motion.div>
                                    ) : (
                                        <form onSubmit={handleQuoteSubmit} className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <input
                                                    type="text"
                                                    value={customerName}
                                                    onChange={(e) => setCustomerName(e.target.value)}
                                                    placeholder="FULL NAME"
                                                    className="w-full bg-black/50 border border-gray-700 p-4 rounded-lg focus:border-[var(--primary)] focus:outline-none transition-colors"
                                                    required
                                                />
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    placeholder="EMAIL ADDRESS"
                                                    className="w-full bg-black/50 border border-gray-700 p-4 rounded-lg focus:border-[var(--primary)] focus:outline-none transition-colors"
                                                    required
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={leadStatus === 'submitting'}
                                                className="w-full py-4 bg-white text-black font-bold uppercase tracking-widest hover:bg-[var(--primary)] transition-all flex items-center justify-center gap-2"
                                            >
                                                {leadStatus === 'submitting' ? (
                                                    <Loader2 className="animate-spin" />
                                                ) : (
                                                    <>Request Quote <Quote className="w-4 h-4" /></>
                                                )}
                                            </button>
                                        </form>
                                    )}
                                </div>

                                {/* Background glow */}
                                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary)]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                            </div>
                        </div>
                    </div>
                </motion.section>
            )}
        </main>
    );
}
