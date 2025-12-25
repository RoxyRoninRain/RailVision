'use client';

import { useState, useEffect } from 'react';
import { Lead, deleteLead, getOwnerLeads } from '@/app/actions';
import { LeadCard } from '@/components/dashboard/LeadCard';
import { LeadDetailModal } from '@/components/dashboard/LeadDetailModal';
import { MessageSquareQuote } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

export default function LeadsDashboard({ initialLeads }: { initialLeads: Lead[] }) {
    const [leads, setLeads] = useState<Lead[]>(initialLeads);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [limit, setLimit] = useState<number>(10);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchLeads = async () => {
            setLoading(true);
            const data = await getOwnerLeads(limit, filterStatus);
            setLeads(data);
            setLoading(false);
        };

        if (limit !== 10 || filterStatus !== 'All') {
            fetchLeads();
        }
    }, [limit, filterStatus]);

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


    return (
        <div className="min-h-screen bg-[#050505] p-6 md:p-8 text-white relative font-sans">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-6 border-b border-gray-900 pb-6">
                <div>
                    <h1 className="text-4xl font-mono font-bold text-[var(--primary)] uppercase tracking-tighter mb-2">
                        Leads Pipeline
                    </h1>
                    <p className="text-gray-500 font-light">Manage your quotes and sales.</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Filter Status */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-zinc-900 text-gray-300 border border-zinc-800 px-3 py-2 rounded text-xs font-mono uppercase focus:border-[var(--primary)] outline-none"
                    >
                        <option value="All">All Statuses</option>
                        <option value="New">New</option>
                        <option value="Pending">Pending</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Sold">Sold</option>
                        <option value="Backed Out">Backed Out</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Closed">Closed</option>
                    </select>

                    {/* Limit */}
                    <select
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        className="bg-zinc-900 text-gray-300 border border-zinc-800 px-3 py-2 rounded text-xs font-mono uppercase focus:border-[var(--primary)] outline-none"
                    >
                        <option value={10}>Show 10</option>
                        <option value={25}>Show 25</option>
                        <option value={50}>Show 50</option>
                        <option value={100}>Show 100</option>
                        <option value={1000}>Show All</option>
                    </select>

                    <button
                        onClick={handleExport}
                        className="bg-zinc-900 hover:bg-zinc-800 text-gray-300 border border-zinc-800 px-4 py-2 transition-all font-mono text-xs uppercase tracking-widest flex items-center gap-2 rounded"
                    >
                        Export CSV
                    </button>
                </div>
            </div>

            <div className="space-y-8">
                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <MessageSquareQuote className="text-[var(--primary)] text-3xl" />
                        <h2 className="text-2xl font-bold uppercase tracking-widest text-white">
                            {filterStatus === 'All' ? 'Active Leads' : filterStatus}
                        </h2>
                        <span className="bg-zinc-900 text-gray-400 text-xs font-bold px-2 py-1 rounded border border-zinc-800">
                            {leads.length}
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
                        </div>
                    ) : leads.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {leads.map(lead => (
                                <LeadCard
                                    key={lead.id}
                                    lead={lead}
                                    onClick={setSelectedLead}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 border border-dashed border-gray-800 rounded-xl flex flex-col items-center justify-center text-gray-600 bg-[#0a0a0a]">
                            <MessageSquareQuote className="w-12 h-12 mb-4 opacity-50" />
                            <p className="uppercase tracking-widest font-mono text-sm">No Leads Found</p>
                        </div>
                    )}
                </section>
            </div>

            {
                selectedLead && (
                    <LeadDetailModal
                        lead={selectedLead}
                        onClose={() => setSelectedLead(null)}
                        onUpdate={(updatedLead) => {
                            setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
                            // Also update the selected lead so the modal UI updates too
                            setSelectedLead(prev => prev?.id === updatedLead.id ? updatedLead : prev);
                        }}
                    />
                )
            }
        </div >
    );
}
