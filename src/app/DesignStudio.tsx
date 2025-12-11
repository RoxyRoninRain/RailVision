'use client';

import { useState } from 'react';
import { InputSanitizer } from '@/components/security/InputSanitizer';
import { generateDesign, submitLead } from './actions';
import Image from 'next/image';

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
    const [leadStatus, setLeadStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            const validation = InputSanitizer.validate(selectedFile);
            if (!validation.valid) {
                setError(validation.error || 'Invalid file');
                return;
            }
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
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
        const form = e.target as HTMLFormElement;
        const nameInput = form.elements.namedItem('name') as HTMLInputElement;
        if (nameInput) formData.append('customer_name', nameInput.value);
        formData.append('style_name', selectedStyle);

        const res = await submitLead(formData);
        if (res.success) {
            setLeadStatus('success');
        } else {
            setLeadStatus('error');
        }
    };

    return (
        <main className="min-h-screen p-8 text-center pb-20">
            <header className="mb-12">
                <h1 className="text-4xl text-[var(--primary)] mb-2">Mississippi Metal Magic</h1>
                <p className="text-xl text-gray-400 tracking-widest">DESIGN STUDIO</p>
            </header>

            {/* ERROR MESSAGE */}
            {error && (
                <div className="bg-red-900/50 text-red-200 p-4 rounded mb-8 border border-red-500 max-w-lg mx-auto">
                    ⚠️ {error}
                </div>
            )}

            {/* STEP 1: UPLOAD */}
            {step === 1 && (
                <section className="max-w-xl mx-auto border border-[var(--secondary)] p-8 rounded-lg bg-[#111]">
                    <h2 className="text-2xl mb-6">Step 1: Upload Your Staircase</h2>

                    <div className="border-2 border-dashed border-[var(--primary)] p-12 rounded cursor-pointer hover:bg-white/5 transition-colors relative">
                        <input
                            type="file"
                            onChange={handleFileChange}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            accept=".jpg,.jpeg,.png"
                        />
                        {preview ? (
                            <img src={preview} alt="Preview" className="max-h-64 mx-auto rounded" />
                        ) : (
                            <div className="text-[var(--primary)]">
                                <p className="text-4xl mb-2">⬆️</p>
                                <p>Drag & Drop or Click to Upload</p>
                                <p className="text-xs text-gray-500 mt-2">Max 5MB • JPG/PNG</p>
                            </div>
                        )}
                    </div>

                    <button
                        disabled={!file}
                        onClick={() => setStep(2)}
                        className="mt-8 w-full py-4 text-lg"
                    >
                        Next: Select Style &rarr;
                    </button>
                </section>
            )}

            {/* STEP 2: VISUALIZE */}
            {step === 2 && (
                <section className="max-w-4xl mx-auto flex flex-col md:flex-row gap-8">
                    <div className="flex-1">
                        {preview && <img src={preview} alt="Original" className="w-full rounded border border-[var(--secondary)] opacity-50" />}
                    </div>

                    <div className="flex-1 text-left space-y-6">
                        <h2 className="text-2xl mb-4">Step 2: Customization</h2>

                        <div>
                            <label className="block text-gray-400 mb-2">Select Style:</label>
                            <select
                                value={selectedStyle}
                                onChange={(e) => setSelectedStyle(e.target.value)}
                                className="w-full bg-transparent border border-[var(--primary)] text-[var(--foreground)] p-3 rounded"
                            >
                                {styles.length > 0 ? (
                                    styles.map(s => <option key={s.id} value={s.name}>{s.name}</option>)
                                ) : (
                                    <option value="Industrial">Industrial</option>
                                )}
                            </select>
                        </div>

                        <div className="p-4 bg-[var(--secondary)]/30 rounded text-sm text-gray-400">
                            AI Processing provided by Vertex Gemini 3.
                            <br />Strict Privacy Policy Enforced.
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={loading}
                            className="w-full py-4 text-lg"
                        >
                            {loading ? 'Generating Layout...' : '✨ Generate Visualization'}
                        </button>
                    </div>
                </section>
            )}

            {/* STEP 3: CONVERSION */}
            {step === 3 && (
                <section className="max-w-4xl mx-auto">
                    <h2 className="text-3xl mb-8 text-[var(--primary)]">Your Custom Design</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                        <div className="relative">
                            <div className="absolute top-4 left-4 bg-black/80 text-white px-2 py-1 text-xs z-10">ORIGINAL</div>
                            {preview && <img src={preview} alt="Original" className="w-full rounded opacity-70 grayscale" />}
                        </div>
                        <div className="bg-[#222] p-6 rounded border border-[var(--primary)] flex items-center justify-center text-left">
                            <div>
                                <h3 className="text-xl mb-4 text-[var(--accent)]">AI Analysis & Concept</h3>
                                <p className="leading-relaxed text-gray-300">{result}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[var(--primary)] text-black p-8 rounded-lg">
                        <h3 className="text-2xl mb-4">Unlock Full Resolution & Quote</h3>
                        {leadStatus === 'success' ? (
                            <div className="bg-black/20 p-4 rounded text-center">
                                ✅ request sent! We will contact you shortly.
                            </div>
                        ) : (
                            <>
                                <p className="mb-6">Get the high-res visualization and a detailed quote from our engineers.</p>
                                <form onSubmit={handleQuoteSubmit} className="max-w-md mx-auto space-y-4">
                                    <input
                                        type="text"
                                        name="name"
                                        placeholder="Enter your name"
                                        className="w-full p-3 rounded border-none text-black"
                                        required
                                    />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter your email"
                                        className="w-full p-3 rounded border-none text-black"
                                        required
                                    />
                                    <button type="submit" disabled={leadStatus === 'submitting'} className="w-full bg-black text-white hover:bg-gray-800 border-none">
                                        {leadStatus === 'submitting' ? 'Sending...' : 'Request Quote'}
                                    </button>
                                    {leadStatus === 'error' && <p className="text-red-900">Failed to submit. Try again.</p>}
                                </form>
                            </>
                        )}
                    </div>
                </section>
            )}
        </main>
    );
}
