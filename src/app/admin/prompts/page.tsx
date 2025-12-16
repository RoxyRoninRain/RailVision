'use client';

import { useState, useEffect } from 'react';
import { getAllSystemPrompts, updateSystemPrompt, createSystemPrompt, setActivePrompt, testDesignGeneration, diagnoseConnection, SystemPrompt } from '@/app/admin/actions';
import { Save, ArrowLeft, Bot, RefreshCw, CheckCircle, AlertTriangle, Plus, Play, Power, X, Upload, Image as ImageIcon } from 'lucide-react';
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
    const [editNegative, setEditNegative] = useState('');

    // Create State
    const [showCreate, setShowCreate] = useState(false);
    const [newKey, setNewKey] = useState('');

    // Test State
    const [showTestModal, setShowTestModal] = useState(false);
    const [testTarget, setTestTarget] = useState<File | null>(null);
    const [testStyle, setTestStyle] = useState<File | null>(null);
    const [testResult, setTestResult] = useState<string | null>(null);
    const [isTesting, setIsTesting] = useState(false);

    // Preview URLs for inputs
    const [targetPreview, setTargetPreview] = useState<string | null>(null);
    const [stylePreview, setStylePreview] = useState<string | null>(null);

    // DEBUG STATE
    const [debugError, setDebugError] = useState<string | null>(null);

    const fetchPrompts = async () => {
        setLoading(true);
        getAllSystemPrompts()
            .then(data => {
                if (data.length === 0) {
                    setDebugError("No prompts returned. (Check RLS or DB 'updated_at' column)");
                    // diagnoseConnection().then(report => setDebugError("DIAGNOSTIC REPORT:\n" + report));
                }
                if (data.length > 0) {
                    setPrompts(data);
                    const active = data.find(p => p.is_active);
                    if (!selectedPrompt) selectPrompt(active || data[0]);
                }
            })
            .catch(err => setDebugError("Fetch Error: " + err.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchPrompts();
    }, []);

    const selectPrompt = (prompt: SystemPrompt) => {
        setSelectedPrompt(prompt);
        setEditInstruction(prompt.system_instruction);
        setEditTemplate(prompt.user_template);
        setEditNegative(prompt.negative_prompt || '');
        setSaveStatus('idle');
    };

    const handleSave = async () => {
        if (!selectedPrompt) return;
        setSaving(true);
        setSaveStatus('idle');

        const res = await updateSystemPrompt(selectedPrompt.key, {
            system_instruction: editInstruction,
            user_template: editTemplate,
            negative_prompt: editNegative
        });

        if (res.success) {
            setSaveStatus('success');
            // Update local list
            setPrompts(prev => prev.map(p =>
                p.key === selectedPrompt.key
                    ? { ...p, system_instruction: editInstruction, user_template: editTemplate, negative_prompt: editNegative }
                    : p
            ));
        } else {
            console.error(res.error);
            setSaveStatus('error');
        }
        setSaving(false);
    };

    const handleCreate = async () => {
        if (!newKey.trim()) return;
        setSaving(true);
        const res = await createSystemPrompt(newKey, "Your Instructions Here...", "[Input]");
        if (res.success) {
            setNewKey('');
            setShowCreate(false);
            fetchPrompts(); // Refresh list
        } else {
            alert('Failed to create: ' + res.error);
        }
        setSaving(false);
    };

    // --- ACTIVATION LOGIC ---
    const [activationTarget, setActivationTarget] = useState<string | null>(null);

    const handleActivateClick = (key: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setActivationTarget(key);
    };

    const confirmActivation = async () => {
        if (!activationTarget) return;

        const key = activationTarget;
        setActivationTarget(null); // Close modal immediately (Optimistic UI)
        setSaving(true); // Show global saving indicator

        // Optimistic local update
        setPrompts(prev => prev.map(p => ({
            ...p,
            is_active: p.key === key
        })));
        if (selectedPrompt?.key === key) {
            setSelectedPrompt(prev => prev ? { ...prev, is_active: true } : null);
        }

        const res = await setActivePrompt(key);

        if (!res.success) {
            alert('Failed to activate: ' + res.error);
            // Revert on failure
            fetchPrompts();
        }
        setSaving(false);
    };

    // --- TESTING LOGIC ---
    const handleOpenTest = () => {
        setShowTestModal(true);
        setTestResult(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'target' | 'style') => {
        const file = e.target.files?.[0];
        if (!file) return;

        const url = URL.createObjectURL(file);

        if (type === 'target') {
            setTestTarget(file);
            setTargetPreview(url);
        } else {
            setTestStyle(file);
            setStylePreview(url);
        }
    };

    const runTest = async () => {
        if (!testTarget || !testStyle) {
            alert("Please upload both a target scene and a style reference.");
            return;
        }

        setIsTesting(true);
        setTestResult(null);

        const formData = new FormData();
        formData.append('image', testTarget);
        formData.append('style_image', testStyle);
        // Pass the CURRENT edits, allowing live testing before save
        formData.append('system_instruction', editInstruction);
        formData.append('user_template', editTemplate);
        formData.append('negative_prompt', editNegative);

        const res = await testDesignGeneration(formData);

        if (res.success && res.image) {
            setTestResult(res.image);
        } else {
            alert("Test Failed: " + (res.error || "Unknown"));
        }
        setIsTesting(false);
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
                        <span>MODEL: GEMINI-PRO-3.0</span>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden">
                {debugError && (
                    <div className="absolute top-4 right-4 z-50 bg-red-600 text-white p-4 rounded shadow-xl font-mono text-xs max-w-lg whitespace-pre-wrap">
                        <strong className="block mb-1">DEBUG ERROR:</strong>
                        {debugError}
                        <br />
                        <span className="opacity-50 mt-2 block">Take a screenshot of this.</span>
                    </div>
                )}

                {/* SIDEBAR: PROMPT LIST */}
                <div className="w-80 border-r border-white/10 bg-[#0a0a0a] flex flex-col">
                    <div className="p-4 border-b border-white/5 flex items-center justify-between">
                        <h2 className="text-xs font-mono text-gray-500 uppercase tracking-widest">Available Prompts</h2>
                        <button onClick={() => setShowCreate(!showCreate)} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors">
                            <Plus size={16} />
                        </button>
                    </div>

                    {showCreate && (
                        <div className="p-3 bg-red-900/10 border-b border-red-900/20">
                            <input
                                className="w-full bg-[#050505] border border-white/10 p-2 text-xs text-white rounded mb-2 focus:border-red-500 outline-none"
                                placeholder="New Prompt Key (e.g. experimental-v1)"
                                value={newKey}
                                onChange={e => setNewKey(e.target.value)}
                            />
                            <button
                                onClick={handleCreate}
                                disabled={saving}
                                className="w-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-1 rounded uppercase tracking-wider"
                            >
                                {saving ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {prompts.map(prompt => (
                            <div
                                key={prompt.key}
                                onClick={() => selectPrompt(prompt)}
                                className={`w-full text-left p-3 rounded group relative transition-all border cursor-pointer ${selectedPrompt?.key === prompt.key
                                    ? 'bg-red-900/10 border-red-900/40 text-white shadow-[0_0_15px_rgba(220,38,38,0.15)]'
                                    : 'bg-transparent border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="font-bold truncate text-sm font-mono">{prompt.key}</div>
                                    {prompt.is_active && (
                                        <div className="flex items-center gap-1 bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded text-[10px] font-mono border border-green-800/50 uppercase tracking-wider">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                            LIVE
                                        </div>
                                    )}
                                </div>
                                <div className="text-[10px] opacity-60 truncate mt-1">
                                    {prompt.created_at ? new Date(prompt.created_at).toLocaleDateString() : 'N/A'}
                                </div>

                                {/* Hover Actions */}
                                {!prompt.is_active && (
                                    <button
                                        onClick={(e) => handleActivateClick(prompt.key, e)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-zinc-800 hover:bg-green-700 text-gray-400 hover:text-white rounded-full z-10"
                                        title="Make Live Check"
                                    >
                                        <Power size={12} />
                                    </button>
                                )}
                            </div>
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
                                        onClick={handleOpenTest}
                                        className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors border border-white/10"
                                    >
                                        <Play size={12} className="text-blue-400" />
                                        Test Prompt
                                    </button>

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

                                {/* SYSTEM PROMPT (Left Column - 60% width ideal, but flex-1 is fine for split) */}
                                <div className="flex-[3] flex flex-col p-4 md:p-6 overflow-hidden">
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

                                {/* RIGHT COLUMN (User Template + Negative Prompt) */}
                                <div className="flex-[2] flex flex-col divide-y divide-white/10 overflow-hidden bg-[#080808]">

                                    {/* USER TEMPLATE (Top Half) */}
                                    <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
                                        <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3 block">User Template (The "Input")</label>
                                        <textarea
                                            value={editTemplate}
                                            onChange={e => setEditTemplate(e.target.value)}
                                            className="flex-1 w-full bg-[#0a0a0a] border border-white/10 p-4 rounded text-sm text-blue-300 font-mono leading-relaxed outline-none focus:border-blue-500/50 resize-none selection:bg-blue-500/20"
                                            spellCheck={false}
                                        />
                                        <p className="text-[10px] text-gray-600 mt-2 font-mono">
                                            Structure of the user's request. Use {'{{variable}}'} placeholders.
                                        </p>
                                    </div>

                                    {/* NEGATIVE PROMPT (Bottom Half) */}
                                    <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden bg-[#050505]">
                                        <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3 block">Negative Prompt (Constraints)</label>
                                        <textarea
                                            value={editNegative}
                                            onChange={e => setEditNegative(e.target.value)}
                                            className="flex-1 w-full bg-[#0a0a0a] border border-white/10 p-4 rounded text-sm text-red-300 font-mono leading-relaxed outline-none focus:border-red-500/50 resize-none selection:bg-red-500/20"
                                            spellCheck={false}
                                            placeholder="Things to avoid..."
                                        />
                                        <p className="text-[10px] text-gray-600 mt-2 font-mono">
                                            Explicitly forbidden elements (e.g. text, watermarks, bad geometry).
                                        </p>
                                    </div>

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

            {/* ACTIVATION MODAL */}
            {activationTarget && (
                <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#111] border border-green-900/50 w-full max-w-sm rounded-lg shadow-2xl p-6 relative">
                        <button onClick={() => setActivationTarget(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                            <X size={20} />
                        </button>

                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-16 h-16 bg-green-900/20 rounded-full flex items-center justify-center text-green-500 mb-2">
                                <Power size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-white">Activate Prompt?</h3>
                            <p className="text-gray-400 text-sm">
                                Are you sure you want to make <span className="text-white font-mono font-bold">"{activationTarget}"</span> the LIVE active prompt regarding for all users?
                            </p>
                            <div className="flex gap-3 w-full mt-2">
                                <button
                                    onClick={() => setActivationTarget(null)}
                                    className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded font-bold text-xs uppercase"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmActivation}
                                    className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-bold text-xs uppercase shadow-lg shadow-green-900/20"
                                >
                                    Yes, Activate
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TEST SANDBOX MODAL */}
            {showTestModal && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-[#111] border border-white/10 w-full max-w-4xl max-h-[90vh] rounded-lg shadow-2xl flex flex-col overflow-hidden">

                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#161616]">
                            <div className="flex items-center gap-3">
                                <Bot className="text-blue-500" size={20} />
                                <h3 className="font-bold font-mono text-white">PROMPT TEST SANDBOX</h3>
                            </div>
                            <button onClick={() => setShowTestModal(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                                {/* Inputs */}
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-xs font-mono text-gray-400 uppercase mb-2 block">1. Target Scene (Stairs)</label>
                                        <div className="relative border border-dashed border-white/20 rounded-lg h-40 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer group overflow-hidden">
                                            <input type="file" onChange={e => handleFileChange(e, 'target')} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                                            {targetPreview ? (
                                                <img src={targetPreview} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 text-gray-500 group-hover:text-gray-300">
                                                    <Upload size={24} />
                                                    <span className="text-xs">Upload Photo</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-mono text-gray-400 uppercase mb-2 block">2. Style Reference (Handrail)</label>
                                        <div className="relative border border-dashed border-white/20 rounded-lg h-40 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer group overflow-hidden">
                                            <input type="file" onChange={e => handleFileChange(e, 'style')} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                                            {stylePreview ? (
                                                <img src={stylePreview} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 text-gray-500 group-hover:text-gray-300">
                                                    <ImageIcon size={24} />
                                                    <span className="text-xs">Upload Style</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-3 bg-blue-900/10 border border-blue-900/30 rounded text-[10px] text-blue-300 font-mono">
                                        <h4 className="font-bold flex items-center gap-2 mb-1"><Bot size={12} /> Live Override</h4>
                                        This test will runs using your CURRENT edits in the editor, NOT what is saved in the database.
                                    </div>

                                    <button
                                        onClick={runTest}
                                        disabled={isTesting || !testTarget || !testStyle}
                                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-3 rounded uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all"
                                    >
                                        {isTesting ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
                                        {isTesting ? 'Generating...' : 'Run Neural Generation'}
                                    </button>
                                </div>

                                {/* Results */}
                                <div className="flex flex-col h-full min-h-[300px] border border-white/10 rounded-lg bg-[#000] relative overflow-hidden">
                                    <div className="absolute top-0 left-0 p-2 bg-black/50 backdrop-blur text-[10px] font-mono text-gray-400 border-b border-r border-white/10 rounded-br-lg z-10">
                                        OUTPUT PREVIEW
                                    </div>

                                    {isTesting ? (
                                        <div className="flex-1 flex flex-col items-center justify-center gap-4">
                                            <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-xs font-mono text-blue-400 animate-pulse">Processing tensors...</p>
                                        </div>
                                    ) : testResult ? (
                                        <div className="relative w-full h-full group">
                                            <img src={testResult} className="w-full h-full object-contain" />
                                            <a
                                                href={testResult}
                                                download="test-generation.png"
                                                className="absolute bottom-4 right-4 bg-white text-black px-3 py-1 rounded text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                Download
                                            </a>
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center text-gray-700 font-mono text-xs">
                                            Awaiting Input...
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}
