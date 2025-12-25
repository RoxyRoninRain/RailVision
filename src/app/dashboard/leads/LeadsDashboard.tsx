'use client';

import { useState, useEffect } from 'react';
import { Lead, deleteLead } from '@/app/actions';
import { LeadCard } from '@/components/dashboard/LeadCard';
import { LeadDetailModal } from '@/components/dashboard/LeadDetailModal';
import { getTenantStats } from '@/app/actions';
import { BarChart3, Star, Download, MessageSquareQuote, Image as ImageIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

export default function LeadsDashboard({ initialLeads }: { initialLeads: Lead[] }) {
    const [leads, setLeads] = useState<Lead[]>(initialLeads);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [stats, setStats] = useState<{ totalGenerations: number; topStyle: string } | null>(null);

    // Fetch Stats
    useEffect(() => {
        getTenantStats().then(setStats);
    }, []);

    const handleDelete = async (leadId: string) => {
        // Optimistic Update
        setLeads(prev => prev.filter(l => l.id !== leadId));

        const res = await deleteLead(leadId);
        if (!res.success) {
            // Revert if failed (simple reload or alert, for now alert)
            alert('Failed to delete quote: ' + res.error);
            // In a real app we'd fetch again or keep a backup of state
            window.location.reload();
        }
    };

    const handleExport = () => {
        const headers = ['ID', 'Date', 'Customer', 'Email', 'Style', 'Status', 'Message', 'Total'];
        const rows = leads.map(l => [
            l.id,
            l.created_at,
            l.customer_name,
            l.email,
            l.style_name,
            l.status,
            l.estimate_json?.message || '',
            l.estimate_json?.total || 0
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "railify_leads.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Unified Leads List (filtering out empty ones if needed, or showing all)
    // User requested removing 'Soft Leads' (downloads without quotes).
    // We assume anything with a status != 'Draft' is a quote.
    // Actually, typescript says status is only 'New' | 'Contacted' | 'Closed', so this filter is always true.
    const quoteLeads = leads;

    return (
        <div className="min-h-screen bg-[#050505] p-6 md:p-8 text-white relative font-sans">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6 border-b border-gray-900 pb-6">
                <div>
                    <h1 className="text-4xl font-mono font-bold text-[var(--primary)] uppercase tracking-tighter mb-2">
                        Leads Pipeline
                    </h1>
                    <p className="text-gray-500 font-light">Monitor incoming quote requests and activity.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExport}
                        className="bg-zinc-900 hover:bg-zinc-800 text-gray-300 border border-zinc-800 px-4 py-2 transition-all font-mono text-xs uppercase tracking-widest flex items-center gap-2 rounded"
                    >
                        Export CSV
                    </button>
                </div>
            </div>


            {/* QUICK STATS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                <div className="bg-[#111] border border-gray-800 p-4 rounded-lg flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-mono uppercase tracking-widest">Total Quotes</p>
                        <p className="text-2xl font-bold text-white">{quoteLeads.length}</p>
                    </div>
                    <BarChart3 className="text-[var(--primary)] opacity-50" />
                </div>
                <div className="bg-[#111] border border-gray-800 p-4 rounded-lg flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-mono uppercase tracking-widest">Top Style</p>
                        <p className="text-2xl font-bold text-white capitalize">
                            {(stats?.topStyle || 'None').replace('-', ' ')}
                        </p>
                    </div>
                    <Star className="text-yellow-500 opacity-50" />
                </div>
                <div className="bg-[#111] border border-gray-800 p-4 rounded-lg flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-mono uppercase tracking-widest">Images Generated</p>
                        <p className="text-2xl font-bold text-white">
                            {stats?.totalGenerations || 0}
                        </p>
                    </div>
                    <ImageIcon className="text-blue-500 opacity-50" />
                </div>
            </div>

            <div className="space-y-16">
                {/* 1. Quote Requests */}
                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <MessageSquareQuote className="text-[var(--primary)] text-3xl" />
                        <h2 className="text-2xl font-bold uppercase tracking-widest text-white">Quote Requests</h2>
                        <span className="bg-zinc-900 text-gray-400 text-xs font-bold px-2 py-1 rounded border border-zinc-800">
                            {quoteLeads.length}
                        </span>
                    </div>

                    {quoteLeads.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {quoteLeads.map(lead => (
                                <LeadCard key={lead.id} lead={lead} onClick={setSelectedLead} onDelete={handleDelete} />
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 border border-dashed border-gray-800 rounded-xl flex flex-col items-center justify-center text-gray-600 bg-[#0a0a0a]">
                            <MessageSquareQuote className="w-12 h-12 mb-4 opacity-50" />
                            <p className="uppercase tracking-widest font-mono text-sm">No Quote Requests Yet</p>
                        </div>
                    )}
                </section>
            </div>

            {
                selectedLead && (
                    <LeadDetailModal
                        lead={selectedLead}
                        onClose={() => setSelectedLead(null)}
                    // Pass update handler to modal if supported, otherwise just close
                    />
                )
            }
        </div >
    );
}
