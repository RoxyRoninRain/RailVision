'use client';

import { useState, useEffect } from 'react';
import { getAdminStats, inviteTenant } from '@/app/actions';
import { MoreHorizontal, Shield, ExternalLink, Code, Plus, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Since this was a server component, we need to split or make it client.
// Or we wrap the interactive parts. 
// For speed/simplicity in this edit, I'll switch to client component with effect-based fetching 
// OR I'll keep it server but add Client Components for the modals. 
// "use client" is at the top, so let's refactor the fetch to be effect-based or use a child component.
// WAIT: The previous file was a server component (implied by async).
// I will rewrite it as a Client Component for interactivity, assuming checking auth happens in middleware/layout or via initial props.
// Actually, to preserve SEO/Server fetching, it's better to leave the Page as Server and pass data to a Client "TenantsDashboard" component.
// BUT, to keep edits simple and since I am replacing the file content, I'll just make the whole page "use client" and fetch in useEffect 
// OR simpler: Make the Page "use client" but that prevents direct server actions in render.
// Correction: I can import server actions in client components.
// So I will make this a Client Component.

export default function TenantsPage() {
    const [stats, setStats] = useState<any[]>([]); // simplified type
    const [loading, setLoading] = useState(true);
    const [selectedTenant, setSelectedTenant] = useState<any | null>(null);
    const [showWidgetModal, setShowWidgetModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);

    // Invite Form
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
    const [isSimulation, setIsSimulation] = useState(false);

    // Widget Copy
    const [copied, setCopied] = useState(false);

    // Initial Fetch
    // In a real app, use React Query or SWR. Here, generic effect.
    // Initial Fetch
    useEffect(() => {
        getAdminStats().then(data => {
            setStats(data);
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
                setInviteEmail('');
                setTimeout(() => {
                    setShowInviteModal(false);
                    setInviteStatus('idle');
                }, 2000);
            } else {
                console.error('Invite Failed:', res.error);
                setInviteStatus('error');
            }
        } catch (error) {
            console.error('System Error during invite:', error);
            setInviteStatus('error');
        }
    };

    const handleCopyWidget = () => {
        const url = `https://railvision-5kw8lst4j-johns-projects-1e70bd02.vercel.app/?org=${selectedTenant?.organization_id}`;
        const code = `<iframe src="${url}" width="100%" height="800" frameborder="0" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);"></iframe>`;
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) return <div className="min-h-screen bg-[#050505] p-12 text-gray-500 font-mono">LOADING DIRECTORY...</div>;

    return (
        <div className="min-h-screen bg-[#050505] p-6 md:p-12 text-white font-sans">
            <header className="mb-10 border-b border-gray-900 pb-6 flex flex-col md:flex-row justify-between md:items-end gap-4">
                <div>
                    <h1 className="text-4xl font-mono font-bold text-[var(--primary)] uppercase tracking-tighter mb-2">
                        Tenant Directory
                    </h1>
                    <p className="text-gray-500 text-lg">Manage registered shops and their subscription status.</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right hidden md:block">
                        <p className="text-xs font-mono text-gray-600 uppercase">Total Tenants</p>
                        <p className="text-2xl font-bold font-mono text-white">{stats.length}</p>
                    </div>
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="btn-primary px-6 py-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider hover:bg-white hover:text-black transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Add Tenant
                    </button>
                </div>
            </header>

            <div className="bg-[#0a0a0a] rounded-lg border border-gray-800 overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-[#111] text-gray-400 border-b border-gray-800">
                        <tr>
                            <th className="p-6 font-mono uppercase text-xs tracking-widest font-semibold text-gray-500">Organization / Shop ID</th>
                            <th className="p-6 font-mono uppercase text-xs tracking-widest font-semibold text-gray-500">Leads Generated</th>
                            <th className="p-6 font-mono uppercase text-xs tracking-widest font-semibold text-gray-500">Subscription</th>
                            <th className="p-6 font-mono uppercase text-xs tracking-widest font-semibold text-gray-500 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {stats.map(stat => (
                            <tr key={stat.organization_id} className="hover:bg-white/5 transition-colors group">
                                <td className="p-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center text-[var(--primary)] font-bold">
                                            {stat.organization_id.substring(0, 1).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-mono text-sm text-gray-300 group-hover:text-white transition-colors">{stat.organization_id}</div>
                                            <div className="text-xs text-gray-600">Free Tier</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-6">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-xl font-bold text-white">{stat.count}</span>
                                        <span className="text-xs text-gray-600">total</span>
                                    </div>
                                </td>
                                <td className="p-6">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-900/20 text-green-400 border border-green-900/30">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                                        Active
                                    </span>
                                </td>
                                <td className="p-6 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => { setSelectedTenant(stat); setShowWidgetModal(true); }}
                                            className="text-xs font-mono text-[var(--primary)] border border-[var(--primary)]/30 px-3 py-1.5 rounded hover:bg-[var(--primary)] hover:text-black transition-colors flex items-center gap-2"
                                        >
                                            <Code className="w-3 h-3" /> Get Widget
                                        </button>
                                        <button className="text-gray-500 hover:text-[var(--primary)] transition-colors p-2 rounded hover:bg-gray-800">
                                            <MoreHorizontal size={20} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {stats.length === 0 && (
                            <tr><td colSpan={4} className="p-16 text-center text-gray-600 font-mono italic">No active tenants found in the database.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* WIDGET MODAL */}
            <AnimatePresence>
                {showWidgetModal && selectedTenant && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                            className="bg-[#111] border border-gray-800 p-8 rounded-xl max-w-2xl w-full shadow-2xl relative"
                        >
                            <button onClick={() => setShowWidgetModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><Plus className="rotate-45" /></button>
                            <h2 className="text-2xl font-bold font-mono text-white mb-2">Embed Code Generator</h2>
                            <p className="text-gray-400 mb-6">Install the Railify widget on {selectedTenant.organization_id}&apos;s website.</p>

                            <div className="bg-black border border-gray-800 p-4 rounded-lg mb-6 group relative">
                                <code className="font-mono text-xs text-gray-300 block bg-transparent resize-none h-24 overflow-y-auto outline-none">
                                    {`<iframe src="https://railvision-5kw8lst4j-johns-projects-1e70bd02.vercel.app/?org=${selectedTenant.organization_id}" width="100%" height="800" frameborder="0" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);"></iframe>`}
                                </code>
                                <button
                                    onClick={handleCopyWidget}
                                    className="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-[var(--primary)] hover:text-black rounded transition-colors text-white"
                                >
                                    {copied ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                            </div>

                            <div className="bg-blue-900/10 border border-blue-900/30 p-4 rounded flex items-start gap-3">
                                <div className="bg-blue-900/20 p-2 rounded-full text-blue-400"><ExternalLink size={16} /></div>
                                <div>
                                    <h4 className="text-blue-200 font-bold text-sm mb-1">How it works</h4>
                                    <p className="text-blue-300/70 text-xs">
                                        This iframe loads the Visualizer with this shop&apos;s unique ID. All leads generated will be automatically tagged with
                                        <span className="font-mono bg-blue-900/30 px-1 mx-1 rounded text-white">{selectedTenant.organization_id}</span>
                                        and appear in their dashboard.
                                    </p>
                                </div>
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
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                            className="bg-[#111] border border-gray-800 p-8 rounded-xl max-w-md w-full shadow-2xl relative"
                        >
                            <button onClick={() => setShowInviteModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><Plus className="rotate-45" /></button>
                            <h2 className="text-xl font-bold font-mono text-white mb-2">Onboard New Tenant</h2>
                            <p className="text-gray-400 mb-6 text-sm">Send an invitation to a new shop owner.</p>

                            <form onSubmit={handleInvite} className="space-y-4">
                                <div>
                                    <label className="text-xs font-mono text-gray-500 uppercase">Email Address</label>
                                    <input
                                        type="email"
                                        value={inviteEmail}
                                        onChange={e => setInviteEmail(e.target.value)}
                                        className="w-full bg-black border border-gray-800 p-3 rounded text-white focus:border-[var(--primary)] outline-none mt-1"
                                        placeholder="owner@newshop.com"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={inviteStatus === 'sending' || inviteStatus === 'sent'}
                                    className="btn-primary w-full py-3 font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                                >
                                    {inviteStatus === 'sending' ? 'Sending...' : inviteStatus === 'sent' ? 'Invitation Sent!' : 'Send Invite'}
                                </button>
                                {inviteStatus === 'sent' && (
                                    isSimulation ? (
                                        <div className="bg-yellow-900/20 border border-yellow-900/50 p-3 rounded mt-2">
                                            <p className="text-yellow-500 text-xs font-mono text-center font-bold">SIMULATION MODE</p>
                                            <p className="text-gray-400 text-xs text-center">Service Key missing on Server. Email was NOT sent.</p>
                                        </div>
                                    ) : (
                                        <div className="bg-green-900/20 border border-green-900/50 p-3 rounded mt-2">
                                            <p className="text-green-500 text-xs font-mono text-center font-bold">INVITATION SENT</p>
                                            <p className="text-gray-400 text-xs text-center">The user will receive an email to join Railify.</p>
                                        </div>
                                    )
                                )}
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
