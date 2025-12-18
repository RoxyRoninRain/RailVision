'use client';

import { useState } from 'react';
import { generateExperimentalDesign } from '@/app/actions/experimental';
import { notFound } from 'next/navigation';

export default function ExperimentalPage() {
    // SECURITY: Ensure this only runs in development mode
    if (process.env.NODE_ENV !== 'development') {
        notFound();
    }
    const [targetFile, setTargetFile] = useState<File | null>(null);
    const [styleFile, setStyleFile] = useState<File | null>(null);
    const [status, setStatus] = useState('idle');
    const [results, setResults] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetFile || !styleFile) return;

        setStatus('processing');
        setError(null);
        setResults(null);

        const formData = new FormData();
        formData.append('image', targetFile);
        formData.append('style_image', styleFile);

        try {
            const res = await generateExperimentalDesign(formData);
            if (res.success) {
                setResults(res.steps);
                setStatus('complete');
            } else {
                setError(res.error || 'Unknown error');
                setStatus('error');
            }
        } catch (err: any) {
            setError(err.message);
            setStatus('error');
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 font-sans">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Experimental 3-Step Pipeline (Multimodal)
            </h1>

            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Target Image Input */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">1. Target Image (The Space)</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setTargetFile(e.target.files?.[0] || null)}
                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                            {targetFile && <p className="text-xs text-gray-500">Selected: {targetFile.name}</p>}
                        </div>

                        {/* Style Image Input */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">2. Style Reference (The Look)</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setStyleFile(e.target.files?.[0] || null)}
                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                            />
                            {styleFile && <p className="text-xs text-gray-500">Selected: {styleFile.name}</p>}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={status === 'processing' || !targetFile || !styleFile}
                        className="w-full py-4 px-6 text-white font-semibold bg-gradient-to-r from-gray-900 to-black rounded-xl hover:from-gray-800 hover:to-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                    >
                        {status === 'processing' ? 'Running AI Pipeline...' : 'Generate Design'}
                    </button>
                </form>

                {error && (
                    <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
                        {error}
                    </div>
                )}
            </div>

            {results && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Step 1: Router */}
                    <div className={`p-4 rounded-xl border ${results.step1.status === 'error' ? 'border-red-200 bg-red-50' : 'border-blue-100 bg-blue-50'}`}>
                        <h3 className="font-semibold text-blue-900 mb-2">Step 1: Detection</h3>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-200 text-blue-800">Gemini 2.5 Flash-Lite</span>
                        </div>
                        <div className="mt-2 p-2 bg-white/50 rounded border border-blue-100 text-xs font-mono">
                            {JSON.stringify(results.step1.result, null, 2)}
                        </div>
                    </div>

                    {/* Step 2: Demolition */}
                    <div className={`p-4 rounded-xl border ${results.step2.status === 'skipped' ? 'border-gray-200 bg-gray-50' : 'border-orange-100 bg-orange-50'}`}>
                        <h3 className="font-semibold text-orange-900 mb-2">Step 2: Auto-Demolition</h3>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 text-xs rounded-full bg-orange-200 text-orange-800">Imagen 3 (Edit)</span>
                        </div>
                        <p className="text-xs font-mono mt-1 text-orange-700 uppercase">{results.step2.status}</p>
                        {results.step2.image && (
                            <img src={results.step2.image} alt="Demolished" className="mt-3 w-full rounded-lg shadow-sm" />
                        )}
                    </div>

                    {/* Step 3: Construction */}
                    <div className={`p-4 rounded-xl border ${results.step3.status === 'failed' ? 'border-red-200 bg-red-50' : 'border-green-100 bg-green-50'}`}>
                        <h3 className="font-semibold text-green-900 mb-2">Step 3: Construction</h3>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 text-xs rounded-full bg-green-200 text-green-800">Gemini 3 Pro</span>
                        </div>
                        <p className="text-xs font-mono mt-1 text-green-700 uppercase">{results.step3.status}</p>
                        {results.step3.image && (
                            <img src={results.step3.image} alt="Final Design" className="mt-3 w-full rounded-lg shadow-md" />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
