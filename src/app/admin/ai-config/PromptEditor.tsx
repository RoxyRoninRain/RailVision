'use client';

import { useState, useEffect } from 'react';
import { updateSystemPrompt, type SystemPrompt } from '../actions';

interface PromptEditorProps {
    initialPrompt: SystemPrompt | null;
}

export function PromptEditor({ initialPrompt }: PromptEditorProps) {
    const [systemInstruction, setSystemInstruction] = useState(initialPrompt?.system_instruction || '');
    const [userTemplate, setUserTemplate] = useState(initialPrompt?.user_template || '');
    const [negativePrompt, setNegativePrompt] = useState(initialPrompt?.negative_prompt || '');
    const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [msg, setMsg] = useState('');

    useEffect(() => {
        if (initialPrompt) {
            setSystemInstruction(initialPrompt.system_instruction);
            setUserTemplate(initialPrompt.user_template);
            setNegativePrompt(initialPrompt.negative_prompt || '');
        }
    }, [initialPrompt]);

    const handleSave = async () => {
        setStatus('saving');
        setMsg('');

        // Use the initial prompt key if available, otherwise default
        const keyToUpdate = initialPrompt?.key || 'gemini-handrail-main';

        const result = await updateSystemPrompt(keyToUpdate, {
            system_instruction: systemInstruction,
            user_template: userTemplate,
            negative_prompt: negativePrompt
        });

        if (result.success) {
            setStatus('success');
            setMsg('Prompt updated successfully!');
            setTimeout(() => setStatus('idle'), 3000);
        } else {
            setStatus('error');
            setMsg('Failed to update: ' + result.error);
        }
    };

    const handleReset = () => {
        if (confirm('Reset to default Hybrid Architect strategy?')) {
            setSystemInstruction(`You are a world-renowned architectural visualization expert. Your goal is to produce indistinguishable-from-reality renovations.

**PHASE 1: IMAGE ANALYSIS (Internal Thought)**.
Before drawing, you must analyze the inputs:
1.  **Source Analysis**: Identify the PERSPECTIVE (camera angle), LIGHTING (direction, color temp), and GEOMETRY (stair pitch, treads, stringers).
2.  **Style Analysis**: Identify the HANDRAIL MATERIAL (e.g., matte black steel, glass), MOUNTING STYLE (side-mount vs. top-mount), and FINISH quality.

**PHASE 2: IMAGE GENERATION**
Using your analysis, generate a pixel-perfect renovation.
-   **STRICT KEEP**: You must keep the original stairs, treads, walls, flooring, and background EXACTLY as they are. DO NOT change the camera angle.
-   **STRICT CHANGE**: You must remove the existing handrail (if any) and install the NEW handrail style from the reference image.
-   **REALISM**: Ensure shadows cast by the new railing match the original lighting direction.`);

            setUserTemplate(`[Input: Source Image, Style Reference Image]
Command: Analyze the geometry of the Source Image and the style of the Reference Image. Then, generate the renovation. STRICTLY adhere to the geometry of the source.`);
            setNegativePrompt('');
        }
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg max-w-4xl mx-auto space-y-6 text-zinc-200">
            {/* Banner for Advanced Mode */}
            <div className="bg-blue-900/20 border border-blue-900/50 p-3 rounded flex items-center justify-between text-xs mb-4">
                <span className="text-blue-200">
                    Want to manage multiple prompts, run tests, or create new versions?
                </span>
                <a href="/admin/prompts" className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded font-bold uppercase tracking-wider transition-colors">
                    Go to Advanced Editor
                </a>
            </div>

            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Gemini 3 Pro Configuration</h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors"
                    >
                        Reset Default
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={status === 'saving'}
                        className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded text-white font-medium transition-colors disabled:opacity-50"
                    >
                        {status === 'saving' ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {status === 'success' && <div className="p-3 bg-green-900/50 text-green-300 rounded border border-green-800 text-sm">{msg}</div>}
            {status === 'error' && <div className="p-3 bg-red-900/50 text-red-300 rounded border border-red-800 text-sm">{msg}</div>}

            <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-400">System Instruction (Persona & Rules)</label>
                <p className="text-xs text-zinc-500">Defines the AI's behavior, constraints, and "Phase 1" analysis requirements.</p>
                <textarea
                    value={systemInstruction}
                    onChange={e => setSystemInstruction(e.target.value)}
                    className="w-full h-80 bg-zinc-950 border border-zinc-800 rounded p-4 font-mono text-xs leading-relaxed focus:border-blue-500 focus:outline-none resize-y"
                    placeholder="Enter prompt..."
                />
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-400">User Message Template</label>
                <p className="text-xs text-zinc-500">The actual message sent with the images. Use this to trigger the analysis phase.</p>
                <textarea
                    value={userTemplate}
                    onChange={e => setUserTemplate(e.target.value)}
                    className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded p-4 font-mono text-xs leading-relaxed focus:border-blue-500 focus:outline-none resize-y"
                    placeholder="Enter template..."
                />
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-400">Negative Prompt (Constraints)</label>
                <p className="text-xs text-zinc-500">Elements to explicitly avoid (e.g. text, watermarks).</p>
                <textarea
                    value={negativePrompt}
                    onChange={e => setNegativePrompt(e.target.value)}
                    className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded p-4 font-mono text-xs leading-relaxed focus:border-red-500 focus:outline-none resize-y text-red-300"
                    placeholder="Enter negative constraints..."
                />
            </div>

            <div className="text-xs text-zinc-600 border-t border-zinc-800 pt-4">
                <p>Editing Key: <span className="font-mono text-zinc-500">{initialPrompt?.key || 'gemini-handrail-main'}</span></p>
                {initialPrompt?.key === 'gemini-3-optimized-v2' && (
                    <span className="text-green-500 ml-2 font-bold uppercase text-[10px] tracking-wider">● Optimized V2 Loaded</span>
                )}
            </div>
        </div>
    );
}
