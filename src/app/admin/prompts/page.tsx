'use client';

import { useState, useEffect } from 'react';
import { getAllSystemPrompts, updateSystemPrompt, SystemPrompt } from '@/app/admin/actions';
import { Save, ArrowLeft, Bot, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

export default function PromptsPage() {
    const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
    const [selectedPrompt, setSelectedPrompt] = useState<SystemPrompt | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Editor State
    const [editInstruction, setEditInstruction] = useState('');
    const [editTemplate, setEditTemplate] = useState('');

    useEffect(() => {
        loadPrompts();
    }, []);

    const loadPrompts = async () => {
        setLoading(true);
        const data = await getAllSystemPrompts();
        setPrompts(data || []);
        if (data && data.length > 0) {
            selectPrompt(data[0]);
        }
        setLoading(false);
    };

    const selectPrompt = (prompt: SystemPrompt) => {
        setSelectedPrompt(prompt);
        setEditInstruction(prompt.system_instruction);
        setEditTemplate(prompt.user_template);
        setSaveStatus('idle');
    };

    const handleSave = async () => {
        if (!selectedPrompt) return;
        setSaving(true);
        setSaveStatus('idle');

        const res = await updateSystemPrompt(selectedPrompt.key, {
            system_instruction: editInstruction,
            user_template: editTemplate
        });

        if (res.success) {
            setSaveStatus('success');
            // Update local list
            setPrompts(prev => prev.map(p =>
                p.key === selectedPrompt.key
                    ? { ...p, system_instruction: editInstruction, user_template: editTemplate }
                    : p
            ));
        } else {
            console.error(res.error);
            setSaveStatus('error');
        }
        setSaving(false);
    };

    if (loading) return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
            <div className="text-red-500 font-mono animate-pulse tracking-widest">LOADING NEURAL CONFIG...</div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-red-500/30 flex flex-col">
            {/* TOP BAR */}
            <header className="border-b border-white/10 bg-[#0a0a0a] flex-none">
                <div className="max-w-[1920px] mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/tenants" className="text-gray-400 hover:text-white transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <div className="w-px h-6 bg-gray-800"></div>
                        <div className="flex items-center gap-3">
                            <Bot className="text-red-500" size={24} />
                            <h1 className="text-lg font-mono font-bold tracking-tight text-white uppercase">
                                Neural Engine <span className="text-gray-600">Calibration</span>
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
                        <span>MODEL: GEMINI-PRO-1.5</span>
                        <span>STATUS: ACTIVE</span>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden">
                {/* SIDEBAR: PROMPT LIST */}
                <div className="w-80 border-r border-white/10 bg-[#0a0a0a] flex flex-col">
                    <div className="p-4 border-b border-white/5">
                        <h2 className="text-xs font-mono text-gray-500 uppercase tracking-widest">Available Prompts</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {prompts.map(prompt => (
                            <button
                                key={prompt.key}
                                onClick={() => selectPrompt(prompt)}
                                className={`w-full text-left p-3 rounded text-sm font-mono transition-colors border ${selectedPrompt?.key === prompt.key
                                        ? 'bg-red-900/10 border-red-900/40 text-white'
                                        : 'bg-transparent border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                    }`}
                            >
                                <div className="font-bold truncate">{prompt.key}</div>
                                <div className="text-[10px] opacity-60 truncate mt-1">Last updated: {prompt.created_at ? new Date(prompt.created_at).toLocaleDateString() : 'N/A'}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* MAIN: EDITOR */}
                <div className="flex-1 flex flex-col bg-[#050505] relative">
                    {selectedPrompt ? (
                        <>
                            {/* EDITOR TOOLBAR */}
                            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#0a0a0a]/50 backdrop-blur-sm">
                                <div>
                                    <h3 className="text-white font-bold">{selectedPrompt.key}</h3>
                                    <p className="text-xs text-gray-500 font-mono">Editing System Instruction & User Templates</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <AnimatePresence>
                                        {saveStatus === 'success' && (
                                            <motion.div
                                                initial={{ opacity: 0, x: 10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0 }}
                                                className="flex items-center gap-2 text-green-500 text-xs font-mono uppercase"
                                            >
                                                <CheckCircle size={14} /> Saved
                                            </motion.div>
                                        )}
                                        {saveStatus === 'error' && (
                                            <motion.div
                                                initial={{ opacity: 0, x: 10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0 }}
                                                className="flex items-center gap-2 text-red-500 text-xs font-mono uppercase"
                                            >
                                                <AlertTriangle size={14} /> Failed
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="bg-white text-black hover:bg-gray-200 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 transition-colors"
                                    >
                                        {saving ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
                                        {saving ? 'Saving...' : 'Save Configuration'}
                                    </button>
                                </div>
                            </div>

                            {/* EDITOR SPLIT */}
                            <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/10 overflow-hidden">

                                {/* SYSTEM PROMPT */}
                                <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
                                    <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3 block">System Instruction (The "Brain")</label>
                                    <textarea
                                        value={editInstruction}
                                        onChange={e => setEditInstruction(e.target.value)}
                                        className="flex-1 w-full bg-[#0a0a0a] border border-white/10 p-4 rounded text-sm text-gray-300 font-mono leading-relaxed outline-none focus:border-red-500/50 resize-none selection:bg-red-500/20"
                                        spellCheck={false}
                                    />
                                    <p className="text-[10px] text-gray-600 mt-2 font-mono">
                                        Defines the AI's persona, constraints, and core logic.
                                    </p>
                                </div>

                                {/* USER TEMPLATE */}
                                <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden bg-[#080808]">
                                    <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3 block">User Template (The "Input")</label>
                                    <textarea
                                        value={editTemplate}
                                        onChange={e => setEditTemplate(e.target.value)}
                                        className="flex-1 w-full bg-[#0a0a0a] border border-white/10 p-4 rounded text-sm text-blue-300 font-mono leading-relaxed outline-none focus:border-blue-500/50 resize-none selection:bg-blue-500/20"
                                        spellCheck={false}
                                    />
                                    <p className="text-[10px] text-gray-600 mt-2 font-mono">
                                        Structure of the user's request. Use {'{{variable}}'} placeholders if applicable.
                                    </p>
                                </div>

                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-600 font-mono">
                            Select a prompt to begin editing.
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
