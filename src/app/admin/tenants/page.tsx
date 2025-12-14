'use client';

import { useState, useEffect } from 'react';
import { getAdminStats, inviteTenant, testResendConnectivity } from '@/app/actions';
import { getGlobalStats } from '@/app/admin/actions'; // New import
import { MoreHorizontal, Shield, ExternalLink, Code, Plus, Copy, Check, Users, TrendingUp, Activity, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function TenantsPage() {
    const [stats, setStats] = useState<any[]>([]); // Tenant list with counts
    const [globalStats, setGlobalStats] = useState<any>({ totalLeads: 0, activeTenants: 0, conversionRate: 0 });
    const [loading, setLoading] = useState(true);
    const [selectedTenant, setSelectedTenant] = useState<any | null>(null);
    const [showWidgetModal, setShowWidgetModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);

    // Invite Form
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
    const [isSimulation, setIsSimulation] = useState(false);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Widget Copy
    const [copied, setCopied] = useState(false);

    // Troubleshooting
    const [showTroubleshoot, setShowTroubleshoot] = useState(false);
    const [debugKey, setDebugKey] = useState('');
    const [debugSender, setDebugSender] = useState('onboarding@resend.dev');
    const [debugStatus, setDebugStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        Promise.all([
            getAdminStats(),
            getGlobalStats()
        ]).then(([adminData, globalData]) => {
            setStats(adminData);
            setGlobalStats(globalData);
            setLoading(false);
        }).catch(err => {
            console.error("Failed to load stats", err);
            setLoading(false);
        });
    }, []);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviteStatus('sending');
        try {
            const res = await inviteTenant(inviteEmail);
            if (res.success) {
                setInviteStatus('sent');
                setIsSimulation(res.isSimulation || false);
                setInviteLink(res.inviteLink || null);
                setInviteEmail('');
                // Only auto-close if NO link to show
                if (!res.inviteLink) {
                    setTimeout(() => {
                        setShowInviteModal(false);
                        setInviteStatus('idle');
                    }, 3000);
                }
            } else {
                console.error('Invite Failed:', res.error);
                setInviteStatus('error');
                setErrorMessage(res.error || 'Unknown error');
            }
        } catch (error: any) {
            console.error('System Error during invite:', error);
            setInviteStatus('error');
            setErrorMessage(error.message || 'System error');
        }
    };

    const handleDebugEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!debugKey || !inviteEmail) {
            setErrorMessage('Enter API Key and ensure Invite Email is filled above (as recipient).');
            setDebugStatus('error');
            return;
        }

        setDebugStatus('testing');
        const res = await testResendConnectivity(debugKey, debugSender, inviteEmail);

        if (res.success) {
            setDebugStatus('success');
        } else {
            console.error(res.error);
            setDebugStatus('error');
            setErrorMessage(typeof res.error === 'string' ? res.error : JSON.stringify(res.error));
        }
    };

    const handleCopyWidget = () => {
        const url = `https://railvision-six.vercel.app/?org=${selectedTenant?.organization_id}`;
        const code = `<iframe src="${url}" width="100%" height="800" frameborder="0" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);"></iframe>`;
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = stats.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(stats.length / itemsPerPage);

    if (loading) return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
            <div className="text-red-500 font-mono animate-pulse tracking-widest">INITIALIZING COMMAND CENTER...</div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-red-500/30">
            {/* TOP BAR */}
            <header className="border-b border-white/10 bg-[#0a0a0a]">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.5)]"></div>
                        <h1 className="text-xl font-mono font-bold tracking-tight text-white">
                            RAILIFY <span className="text-gray-600">ADMIN</span>
                        </h1>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
                        <span>SYSTEM: ONLINE</span>
                        <span>V.2.4.0</span>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">

                {/* 1. GLOBAL STATS CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[#111] border border-white/5 p-6 rounded-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Activity size={48} className="text-blue-500" />
                        </div>
                        <p className="text-gray-500 text-xs font-mono uppercase tracking-widest mb-1">Global Leads</p>
                        <p className="text-3xl font-bold text-white">{globalStats.totalLeads}</p>
                        <div className="mt-4 text-xs text-blue-400 font-mono">
                            ALL TIME
                        </div>
                    </div>

                    <div className="bg-[#111] border border-white/5 p-6 rounded-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Users size={48} className="text-green-500" />
                        </div>
                        <p className="text-gray-500 text-xs font-mono uppercase tracking-widest mb-1">Active Tenants</p>
                        <p className="text-3xl font-bold text-white">{globalStats.activeTenants}</p>
                        <div className="mt-4 text-xs text-green-400 font-mono">
                            30 DAY ACTIVITY
                        </div>
                    </div>

                    <div className="bg-[#111] border border-white/5 p-6 rounded-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <TrendingUp size={48} className="text-red-500" />
                        </div>
                        <p className="text-gray-500 text-xs font-mono uppercase tracking-widest mb-1">Conversion Rate</p>
                        <p className="text-3xl font-bold text-white">{globalStats.conversionRate}%</p>
                        <div className="mt-4 text-xs text-red-500 font-mono">
                            LEADS CLOSED
                        </div>
                    </div>
                </div>

                {/* 2. TENANT MANAGEMENT + ACTIONS */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/10 pb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">Tenant Directory</h2>
                        <p className="text-gray-500 text-sm">Manage registered shops and access their dashboards.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/admin/prompts"
                            className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2.5 rounded text-sm font-bold uppercase tracking-wider transition-colors flex items-center gap-2 border border-zinc-700"
                        >
                            <Bot className="w-4 h-4" /> AI Prompts
                        </Link>
                        <button
                            onClick={() => setShowInviteModal(true)}
                            className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded text-sm font-bold uppercase tracking-wider transition-colors flex items-center gap-2 shadow-[0_0_20px_rgba(220,38,38,0.3)]"
                        >
                            <Plus className="w-4 h-4" /> Onboard Tenant
                        </button>
                    </div>
                </div>

                {/* 3. TENANT TABLE */}
                <div className="bg-[#0a0a0a] rounded-lg border border-white/5 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#111] text-gray-400 border-b border-white/5">
                            <tr>
                                <th className="p-4 pl-6 font-mono uppercase text-[10px] tracking-widest font-semibold text-gray-500">Shop ID / Organization</th>
                                <th className="p-4 font-mono uppercase text-[10px] tracking-widest font-semibold text-gray-500">Metrics</th>
                                <th className="p-4 font-mono uppercase text-[10px] tracking-widest font-semibold text-gray-500">Status</th>
                                <th className="p-4 pr-6 font-mono uppercase text-[10px] tracking-widest font-semibold text-gray-500 text-right">Controls</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {currentItems.map(stat => (
                                <tr key={stat.organization_id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="p-4 pl-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-500 font-bold text-xs group-hover:border-red-900 group-hover:text-red-500 transition-colors">
                                                {stat.organization_id.substring(0, 1).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-mono text-xs text-gray-300 group-hover:text-white transition-colors">{stat.organization_id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="font-mono text-sm text-white">{stat.count}</span> <span className="text-xs text-gray-600">leads</span>
                                    </td>
                                    <td className="p-4">
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-green-900/10 text-green-500 border border-green-900/20">
                                            Active
                                        </span>
                                    </td>
                                    <td className="p-4 pr-6 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link
                                                href={`/admin/tenants/${stat.organization_id}`}
                                                className="text-[10px] font-mono text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 px-2 py-1 rounded transition-colors flex items-center gap-1"
                                            >
                                                <Eye className="w-3 h-3" /> SHADOW
                                            </Link>
                                            <button
                                                onClick={() => { setSelectedTenant(stat); setShowWidgetModal(true); }}
                                                className="text-[10px] font-mono text-red-500 hover:text-white border border-red-900/30 hover:bg-red-600 px-2 py-1 rounded transition-colors flex items-center gap-1"
                                            >
                                                <Code className="w-3 h-3" /> WIDGET
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {stats.length === 0 && (
                                <tr><td colSpan={4} className="p-16 text-center text-gray-600 font-mono italic">No active tenants found.</td></tr>
                            )}
                        </tbody>
                    </table>

                    {/* PAGINATION */}
                    {totalPages > 1 && (
                        <div className="flex justify-center p-4 border-t border-white/5 gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 text-xs font-mono text-gray-500 disabled:opacity-30 hover:text-white"
                            >
                                PREV
                            </button>
                            <span className="px-3 py-1 text-xs font-mono text-gray-400">PAGE {currentPage} / {totalPages}</span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 text-xs font-mono text-gray-500 disabled:opacity-30 hover:text-white"
                            >
                                NEXT
                            </button>
                        </div>
                    )}
                </div>
            </main>

            {/* WIDGET MODAL */}
            <AnimatePresence>
                {showWidgetModal && selectedTenant && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                            className="bg-[#111] border border-white/10 p-8 rounded-lg max-w-2xl w-full shadow-2xl relative"
                        >
                            <button onClick={() => setShowWidgetModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><Plus className="rotate-45" /></button>
                            <h2 className="text-xl font-bold font-mono text-white mb-2 uppercase tracking-wide">Embed Code Generator</h2>
                            <p className="text-gray-400 mb-6 text-sm">Deploy this iframe to the tenant&apos;s website.</p>

                            <div className="bg-black border border-gray-800 p-4 rounded mb-6 group relative">
                                <code className="font-mono text-xs text-gray-300 block bg-transparent resize-none h-24 overflow-y-auto outline-none selection:bg-red-900/50">
                                    {`<iframe src="https://railvision-six.vercel.app/?org=${selectedTenant.organization_id}" width="100%" height="800" frameborder="0" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);"></iframe>`}
                                </code>
                                <button
                                    onClick={handleCopyWidget}
                                    className="absolute top-2 right-2 p-2 bg-gray-900 border border-gray-800 hover:border-red-500 hover:text-red-500 rounded transition-colors text-gray-400"
                                >
                                    {copied ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* INVITE MODAL */}
            <AnimatePresence>
                {showInviteModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                            className="bg-[#111] border border-white/10 p-8 rounded-lg max-w-md w-full shadow-2xl relative"
                        >
                            <button onClick={() => setShowInviteModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><Plus className="rotate-45" /></button>
                            <h2 className="text-xl font-bold font-mono text-white mb-2 uppercase tracking-wide">Onboard Operations</h2>
                            <p className="text-gray-400 mb-6 text-sm">Send an access key to a new tenant.</p>

                            <form onSubmit={handleInvite} className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Target Email</label>
                                    <input
                                        type="email"
                                        value={inviteEmail}
                                        onChange={e => setInviteEmail(e.target.value)}
                                        className="w-full bg-black border border-gray-800 p-3 rounded text-white focus:border-red-500 outline-none mt-1 font-mono text-sm"
                                        placeholder="user@domain.com"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={inviteStatus === 'sending' || inviteStatus === 'sent'}
                                    className="w-full bg-white text-black py-3 font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
                                >
                                    {inviteStatus === 'sending' ? 'Transmitting...' : inviteStatus === 'sent' ? 'Sent' : 'Initialize Invite'}
                                </button>

                                {inviteStatus === 'sent' && (
                                    <div className="mt-4 space-y-3">
                                        <div className={`p-3 rounded border ${isSimulation ? 'bg-yellow-900/10 border-yellow-900/30' : 'bg-green-900/10 border-green-900/30'}`}>
                                            <p className={`text-xs font-mono font-bold text-center ${isSimulation ? 'text-yellow-500' : 'text-green-500'}`}>
                                                {isSimulation ? 'SIMULATION MODE' : 'TRANSMISSION COMPLETE'}
                                            </p>
                                        </div>

                                        {/* ALWAYS SHOW LINK IF AVAILABLE, EVEN IN SIMULATION */}
                                        {inviteLink && (
                                            <div className="bg-black p-3 rounded border border-gray-800">
                                                <p className="text-[10px] text-gray-500 uppercase font-mono mb-2">Manual Link Protocol:</p>
                                                <div className="flex items-start gap-2">
                                                    <code className="text-[10px] text-red-400 break-all font-mono bg-transparent flex-1 opacity-80">{inviteLink}</code>
                                                    <button
                                                        type="button"
                                                        onClick={() => navigator.clipboard.writeText(inviteLink)}
                                                        className="text-gray-400 hover:text-white"
                                                    >
                                                        <Copy size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {inviteStatus === 'error' && (
                                    <div className="bg-red-900/20 border border-red-900/50 p-3 rounded mt-2">
                                        <p className="text-red-500 text-xs font-mono text-center font-bold">FAILURE</p>
                                        <p className="text-gray-400 text-xs text-center">{errorMessage}</p>
                                    </div>
                                )}
                            </form>

                            {/* TROUBLESHOOTING SECTION */}
                            <div className="mt-6 pt-6 border-t border-gray-800">
                                <button
                                    onClick={() => setShowTroubleshoot(!showTroubleshoot)}
                                    className="text-[10px] text-gray-500 hover:text-gray-300 uppercase font-mono tracking-widest flex items-center gap-2"
                                >
                                    <Shield size={12} /> Troubleshoot Email Connection
                                </button>

                                {showTroubleshoot && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden mt-3 space-y-3">
                                        <p className="text-xs text-gray-500">
                                            Test your Resend API Key directly. If this works, your Key is good but Supabase SMTP settings might be wrong.
                                        </p>
                                        <input
                                            className="w-full bg-black border border-gray-800 p-2 rounded text-xs text-white family-mono"
                                            placeholder="re_123456789..."
                                            value={debugKey}
                                            onChange={e => setDebugKey(e.target.value)}
                                        />
                                        <div className="flex gap-2">
                                            <input
                                                className="flex-1 bg-black border border-gray-800 p-2 rounded text-xs text-white family-mono"
                                                placeholder="Sender (e.g. onboard@...)"
                                                value={debugSender}
                                                onChange={e => setDebugSender(e.target.value)}
                                            />
                                            <button
                                                onClick={handleDebugEmail}
                                                disabled={debugStatus === 'testing'}
                                                className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-3 py-2 rounded uppercase font-bold"
                                            >
                                                {debugStatus === 'testing' ? 'Testing...' : 'Test Key'}
                                            </button>
                                        </div>
                                        {debugStatus === 'success' && (
                                            <div className="p-2 bg-green-900/20 text-green-400 text-xs border border-green-900/40 rounded">
                                                <strong>Success!</strong> Email sent reliably via API. The Key is valid. <br />Check Supabase SMTP: ensure Port is 465 and User is 'resend'.
                                            </div>
                                        )}
                                        {debugStatus === 'error' && (
                                            <div className="p-2 bg-red-900/20 text-red-400 text-xs border border-red-900/40 rounded break-all">
                                                <strong>Error:</strong> {errorMessage}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
