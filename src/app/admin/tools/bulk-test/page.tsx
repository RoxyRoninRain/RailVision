'use client';

import { useState } from 'react';
import { Loader2, Upload, AlertCircle } from 'lucide-react';
import { runBulkTest } from './actions';
import { compressImage } from '@/utils/imageUtils';

const DEFAULT_SYSTEM_PROMPT = `**ROLE:** You are Railify-AI, an expert Architectural Visualization Engine.
**TASK:** Renovate the user's staircase by overlaying a new handrail system.
**DATA LAYERS (STRICT ADHERENCE):**
**LAYER 1: THE SCENE (IMAGE A)**
*   **Status:** IMMUTABLE BACKGROUND.
*   **Rule:** You must NEVER alter the walls, flooring, stair pitch, or lighting. The geometry of the house is locked.
*   **Aspect Ratio** do not change from the image A original aspect ratio.
**LAYER 2: THE PRODUCT (HANDRAIL)**
*   **Status:** THE ONLY VARIABLE.
*   **Source:** Image B, IGNORE BACKGROUND, USE HANDRAIL COMPONENTS ONLY.
*   **Physics:** The rail must track the *Nosing Line* relative to Layer 1.
**STRICT PROHIBITIONS (FATAL ERRORS):**
*   **NO GHOSTING:** Spindles must NEVER pass through a Shoe Rail. (Shoe Rail = Solid Barrier).
*   **NO WARPING:** Do not change the angle or number of steps in the staircase.
*   **NO HALLUCINATIONS:** Do not invent windows, doors, structures or furniture that do not exist in Layer 1.
*   **NO CHANGING:** DO not change the railing style.
*   **If you change a single pixel of the background -> YOU FAIL.
**OUTPUT FORMAT:**
*   **Single Image Identity:** One unified image of Image A room and stairs, but with the handrail style from Image B installed properly on the Image A stairs.
*   **Camera Lock:** Exact aspect ratio and POV of Image A.
*   **Quality Control:** Compare the pixels of new generated image with Image A. If you changed the architecture of the house or steps, revert them back to Image A Pixels. THE HANDRAILS ARE THE ONLY CHANGES THAT CAN BE MADE. EVERYTHING ELSE MUST REMAIN EXACTLY AS THEY ARE IN IMAGE A.`;

const DEFAULT_USER_TEMPLATE = `[INPUTS]
**LAYER 1 (Scene):** User's Staircase (Image A)
**LAYER 2 (Reference):** Handrail Style (Image B)
***
**EXECUTION ORDER:**
1.  **Analyze:** Is there a handrail already in the image? If Yes, proceed to step 2. If No, Move on to step 3.
2.  **Masking:** Digitally mask out the old rail from Layer 1. Heal the background.
3.  **Style:** Analyze Image B, Identify all handrail Components and prepare to design the new handrail with these components. 
4.  **Composition:** Render the new system into the active zone.
{{mounting_logic}}
{{post_style}}
{{termination_style}}
5. 100% Photorealism
6.  **Finalize:** Quality Control, then Apply Layer 1's lighting map to Layer 2's material.`;

export default function BulkTestPage() {
    // Configuration State
    const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
    const [userTemplate, setUserTemplate] = useState(DEFAULT_USER_TEMPLATE);
    const [negPrompt, setNegPrompt] = useState('');

    // Toggles
    const [mountStyle, setMountStyle] = useState('shoerail');
    const [postStyle, setPostStyle] = useState('over_the_post');
    const [termStyle, setTermStyle] = useState('volute');

    // Files
    const [styleFile, setStyleFile] = useState<File | null>(null);
    const [targetFiles, setTargetFiles] = useState<File[]>([]);
    const [stylePreview, setStylePreview] = useState<string | null>(null);

    // Execution State
    const [isRunning, setIsRunning] = useState(false);
    const [isProcessingFiles, setIsProcessingFiles] = useState(false); // New Processing State
    const [results, setResults] = useState<any[]>([]); // { id, status, imageUrl, error, output, usage, name, src }
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [viewMode, setViewMode] = useState<'setup' | 'results'>('setup');

    const handleStyleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsProcessingFiles(true);
            try {
                const file = e.target.files[0];
                console.log("[BulkTest] Processing Style Image:", file.name, file.type);
                const compressed = await compressImage(file); // Handles HEIC
                setStyleFile(compressed);
                setStylePreview(URL.createObjectURL(compressed));
            } catch (err: any) {
                console.error("Style Image Processing Error:", err);
                alert(`Error: ${err.message}. Please use a standard JPG/PNG.`);
            } finally {
                setIsProcessingFiles(false);
            }
        }
    };

    const handleTargetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setIsProcessingFiles(true);
            try {
                const rawFiles = Array.from(e.target.files);
                const processed = [];
                for (const f of rawFiles) {
                    console.log("[BulkTest] Processing Target Image:", f.name, f.type);
                    const c = await compressImage(f);
                    processed.push(c);
                }
                setTargetFiles(processed);
            } catch (err: any) {
                console.error("Target Image Processing Error:", err);
                alert(`Error processing images: ${err.message}`);
            } finally {
                setIsProcessingFiles(false);
            }
        }
    };

    const runTests = async () => {
        if (targetFiles.length === 0) return alert('Please upload at least one target image (Image A)');

        setIsRunning(true);
        setViewMode('results');

        setResults([]);
        setProgress({ current: 0, total: targetFiles.length });

        // Initialize Results Placeholders
        const initResults = targetFiles.map((f, idx) => ({
            id: idx,
            name: f.name,
            status: 'pending',
            src: URL.createObjectURL(f)
        }));
        setResults(initResults);

        for (let i = 0; i < targetFiles.length; i++) {
            const file = targetFiles[i];

            // Mark running
            setResults(prev => prev.map(r => r.id === i ? { ...r, status: 'running' } : r));
            setProgress({ current: i + 1, total: targetFiles.length });

            const formData = new FormData();
            formData.append('target_image', file);
            if (styleFile) formData.append('style_image', styleFile);

            formData.append('system_prompt', systemPrompt);
            formData.append('user_prompt', userTemplate);
            formData.append('negative_prompt', negPrompt);

            formData.append('mount_style', mountStyle);
            formData.append('post_style', postStyle);
            formData.append('termination_style', termStyle);

            try {
                const res = await runBulkTest(formData);
                if (res.success) {
                    setResults(prev => prev.map(r => r.id === i ? { ...r, status: 'success', output: res.image, usage: res.usage } : r));
                } else {
                    setResults(prev => prev.map(r => r.id === i ? { ...r, status: 'error', error: res.error } : r));
                }
            } catch (err: any) {
                setResults(prev => prev.map(r => r.id === i ? { ...r, status: 'error', error: err.message } : r));
            }

            // Simple rate limit buffer
            if (i < targetFiles.length - 1) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        setIsRunning(false);
    };

    // RESULTS VIEW
    if (viewMode === 'results') {
        return (
            <div className="fixed inset-0 bg-[#050505] text-white overflow-y-auto z-[100]">
                <div className="p-8">
                    <div className="flex justify-between items-center mb-8 border-b border-[#333] pb-4 sticky top-0 bg-[#050505] z-10 w-full">
                        <h1 className="text-3xl font-bold text-[var(--primary)]">Test Results</h1>
                        <div className="flex gap-4 items-center">
                            <div className="text-right">
                                <div className="text-sm text-gray-400">Progress</div>
                                <div className="font-mono text-xl">{progress.current} / {progress.total}</div>
                            </div>
                            <button
                                onClick={() => setViewMode('setup')}
                                disabled={isRunning}
                                className="px-6 py-2 bg-[#222] border border-[#444] rounded hover:bg-[#333] disabled:opacity-50 transition-colors"
                            >
                                {isRunning ? 'Running...' : 'New Test'}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                        {results.map((res) => (
                            <div key={res.id} className="bg-[#111] border border-[#333] rounded-xl overflow-hidden shadow-lg h-[400px] flex flex-col">
                                <div className="flex-1 bg-black relative flex">
                                    {/* Before */}
                                    <div className="w-1/2 border-r border-[#333] relative">
                                        <img src={res.src} className="w-full h-full object-cover opacity-60" />
                                        <span className="absolute bottom-2 left-2 text-[10px] bg-black/70 px-2 py-0.5 rounded text-white border border-white/10">ORIGINAL</span>
                                    </div>
                                    {/* After (or loading) */}
                                    <div className="w-1/2 relative bg-checkered">
                                        {res.status === 'success' ? (
                                            <img src={res.output} className="w-full h-full object-cover" />
                                        ) : res.status === 'error' ? (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 p-2 text-center text-xs bg-black/90">
                                                <AlertCircle size={24} className="mb-2" />
                                                <span className="whitespace-pre-wrap break-words w-full px-2 font-mono overflow-y-auto max-h-full">{res.error}</span>
                                            </div>
                                        ) : res.status === 'running' ? (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-brand-gold bg-black/60 backdrop-blur-sm">
                                                <Loader2 className="animate-spin mb-3" size={32} />
                                                <div className="w-2/3 h-1 bg-gray-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-brand-gold animate-progress-indeterminate"></div>
                                                </div>
                                                <span className="text-xs font-bold mt-2 tracking-widest uppercase text-white">Generating</span>
                                            </div>
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-gray-700 text-xs uppercase tracking-widest">
                                                Waiting...
                                            </div>
                                        )}
                                        {res.status === 'success' && <span className="absolute bottom-2 right-2 text-[10px] bg-green-500 text-black px-2 py-0.5 rounded font-bold shadow-lg">GENERATED</span>}
                                    </div>
                                </div>
                                <div className="p-4 text-xs text-gray-400 bg-[#161616] border-t border-[#333] shrink-0">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-white truncate max-w-[200px]" title={res.name}>{res.name}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${res.status === 'success' ? 'bg-green-900/30 text-green-400 border border-green-900' :
                                                res.status === 'error' ? 'bg-red-900/30 text-red-400 border border-red-900' :
                                                    res.status === 'running' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-900' :
                                                        'bg-gray-800 text-gray-500'
                                            }`}>
                                            {res.status}
                                        </span>
                                    </div>
                                    {res.usage ? (
                                        <div className="flex gap-4 font-mono text-[10px] text-gray-500">
                                            <span>IN: <span className="text-white">{res.usage.inputTokens}</span></span>
                                            <span>OUT: <span className="text-white">{res.usage.outputTokens}</span></span>
                                        </div>
                                    ) : (
                                        <div className="h-4"></div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // SETUP VIEW
    return (
        <div className="min-h-screen bg-[#050505] text-white p-8">
            <h1 className="text-3xl font-bold mb-8 text-[var(--primary)]">Bulk Prompt Testing Lab</h1>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* CONFIG PANELS */}
                <div className="xl:col-span-12 space-y-8">

                    {/* 1. IMAGES */}
                    <div className="bg-[#111] p-6 rounded-xl border border-[#333]">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-brand-gold">
                            <span className="bg-brand-gold text-black rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span>
                            Images
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Style Image */}
                            <div>
                                <label className="text-xs text-gray-400 uppercase block mb-2">Style Reference (Image B)</label>
                                <div className="bg-[#222] p-6 rounded border border-[#444] border-dashed text-center relative hover:bg-[#2a2a2a] transition-colors h-48 flex flex-col items-center justify-center group">
                                    {stylePreview ? (
                                        <img src={stylePreview} className="h-full w-full object-contain" />
                                    ) : (
                                        <>
                                            <Upload className="mb-2 opacity-50 text-brand-gold" />
                                            <span className="text-sm text-gray-300">Upload Style Image</span>
                                        </>
                                    )}
                                    <input type="file" onChange={handleStyleUpload} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                                </div>
                            </div>

                            {/* Target Images */}
                            <div>
                                <label className="text-xs text-gray-400 uppercase block mb-2">Target Stairs (Image A) - Batch Input</label>
                                <div className="bg-[#222] p-6 rounded border border-[#444] border-dashed text-center relative hover:bg-[#2a2a2a] transition-colors h-48 flex flex-col items-center justify-center group">
                                    <div className="text-4xl font-bold mb-1 text-white">{targetFiles.length}</div>
                                    <span className="text-sm text-gray-300">Images Selected</span>
                                    <span className="text-xs text-gray-500 mt-2">Click to select multiple files</span>
                                    <input type="file" onChange={handleTargetUpload} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" multiple />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. STYLE LOGIC */}
                    <div className="bg-[#111] p-6 rounded-xl border border-[#333]">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-brand-gold">
                            <span className="bg-brand-gold text-black rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span>
                            Style Logic
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="text-xs text-gray-400 uppercase block mb-1">Mount Style</label>
                                <select value={mountStyle} onChange={e => setMountStyle(e.target.value)} className="w-full bg-[#222] border border-[#444] rounded p-3 text-sm focus:border-brand-gold outline-none">
                                    <option value="shoerail">Shoe Rail</option>
                                    <option value="direct_mount">Direct Mount</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 uppercase block mb-1">Post Style</label>
                                <select value={postStyle} onChange={e => setPostStyle(e.target.value)} className="w-full bg-[#222] border border-[#444] rounded p-3 text-sm focus:border-brand-gold outline-none">
                                    <option value="over_the_post">Over-the-Post</option>
                                    <option value="post_to_post">Post-to-Post</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 uppercase block mb-1">Termination</label>
                                <select value={termStyle} onChange={e => setTermStyle(e.target.value)} className="w-full bg-[#222] border border-[#444] rounded p-3 text-sm focus:border-brand-gold outline-none">
                                    <option value="lambs_tongue">Lambs Tongue</option>
                                    <option value="short_stop">Short Stop</option>
                                    <option value="volute">Volute</option>
                                    <option value="newel_post_termination">Newel Post Term.</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 3. PROMPTS */}
                    <div className="bg-[#111] p-6 rounded-xl border border-[#333]">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-brand-gold">
                            <span className="bg-brand-gold text-black rounded-full w-6 h-6 flex items-center justify-center text-xs">3</span>
                            Prompt Engineering
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div>
                                <label className="text-xs text-gray-400 uppercase block mb-1">System Prompt</label>
                                <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} className="w-full h-48 bg-[#222] border border-[#444] p-3 text-xs font-mono text-gray-300 rounded focus:border-brand-gold outline-none" />
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs text-gray-400 uppercase block mb-1">User Prompt Template</label>
                                    <textarea value={userTemplate} onChange={e => setUserTemplate(e.target.value)} className="w-full h-32 bg-[#222] border border-[#444] p-3 text-xs font-mono text-gray-300 rounded focus:border-brand-gold outline-none" />
                                </div>

                                <div>
                                    <label className="text-xs text-gray-400 uppercase block mb-1">Negative Prompt</label>
                                    <input value={negPrompt} onChange={e => setNegPrompt(e.target.value)} className="w-full bg-[#222] border border-[#444] p-3 text-xs font-mono text-gray-300 rounded focus:border-brand-gold outline-none" placeholder="e.g. text, watermark, bad quality" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ACTION */}
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#050505] border-t border-[#222] flex justify-end z-50">
                        <div className="max-w-[1400px] w-full mx-auto flex justify-end">
                            <button
                                onClick={runTests}
                                disabled={targetFiles.length === 0 || isProcessingFiles || isRunning}
                                className="px-8 py-4 bg-yellow-500 text-black font-bold uppercase rounded text-xl hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-yellow-500/20 transition-all flex items-center gap-3"
                            >
                                {isRunning ? <Loader2 className="animate-spin" /> : isProcessingFiles ? 'Processing...' : `Generate Results (${targetFiles.length})`}
                            </button>
                        </div>
                    </div>
                    <div className="h-24"></div> {/* Spacer for fixed footer */}

                </div>
            </div>
        </div>
    );
}
