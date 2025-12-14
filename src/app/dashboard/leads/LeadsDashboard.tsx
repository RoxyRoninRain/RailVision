'use client';

import { useState } from 'react';
import { Lead } from '@/app/actions';
import { LeadCard } from '@/components/dashboard/LeadCard';
import { LeadDetailModal } from '@/components/dashboard/LeadDetailModal';
import { updateLeadStatus } from '@/app/actions'; // Need to implement this
import { LayoutGrid, List, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { formatDistanceToNow } from 'date-fns';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

export default function LeadsDashboard({ initialLeads }: { initialLeads: Lead[] }) {
    const [leads, setLeads] = useState<Lead[]>(initialLeads);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
    const [loading, setLoading] = useState(false);

    const handleExport = () => {
        const headers = ['ID', 'Date', 'Customer', 'Email', 'Style', 'Status', 'Total'];
        const rows = leads.map(l => [
            l.id,
            l.created_at,
            l.customer_name,
            l.email,
            l.style_name,
            l.status,
            l.estimate_json?.total || 0
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "railvision_leads.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleStatusChange = async (leadId: string, newStatus: 'New' | 'Contacted' | 'Closed') => {
        // Optimistic update
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));

        try {
            const res = await updateLeadStatus(leadId, newStatus);
            if (!res.success) {
                // Revert if failed
                throw new Error(res.error);
            }
        } catch (error) {
            console.error('Failed to update status:', error);
            // Revert (could be improved by fetching fresh data)
            setLeads(initialLeads); // Simple revert for now
            alert('Failed to update status. Please try again.');
        }
    };

    const filteredLeads = (status: string) => leads.filter(l => l.status === status);

    return (
        <div className="min-h-screen bg-[#050505] p-6 md:p-8 text-white relative font-sans">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6 border-b border-gray-900 pb-6">
                <div>
                    <h1 className="text-4xl font-mono font-bold text-[var(--primary)] uppercase tracking-tighter mb-2">
                        Leads Pipeline
                    </h1>
                    <p className="text-gray-500 font-light">Monitor incoming requests and manage deal flow.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExport}
                        className="bg-zinc-900 hover:bg-zinc-800 text-gray-300 border border-zinc-800 px-4 py-2 transition-all font-mono text-xs uppercase tracking-widest flex items-center gap-2 rounded"
                    >
                        Export CSV
                    </button>
                    <div className="bg-zinc-900 p-1 rounded border border-zinc-800 flex gap-1">
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={cn("p-2 rounded transition-colors", viewMode === 'kanban' ? "bg-zinc-800 text-white" : "text-gray-500 hover:text-gray-300")}
                            title="Board View"
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn("p-2 rounded transition-colors", viewMode === 'list' ? "bg-zinc-800 text-white" : "text-gray-500 hover:text-gray-300")}
                            title="List View"
                        >
                            <List size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {viewMode === 'kanban' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-auto md:h-[calc(100vh-250px)]">
                    {['New', 'Contacted', 'Closed'].map((status) => (
                        <div key={status} className="flex flex-col h-full bg-[#111] border border-gray-800/50 rounded-xl overflow-hidden shadow-2xl">
                            <div className={cn(
                                "p-4 border-b border-gray-800 font-mono font-bold flex justify-between items-center bg-black/40 backdrop-blur-sm sticky top-0 z-10",
                                status === 'New' && "text-blue-400",
                                status === 'Contacted' && "text-yellow-400",
                                status === 'Closed' && "text-[var(--primary)]" // Using primary (green usually)
                            )}>
                                <span className="uppercase tracking-widest text-sm">{status}</span>
                                <span className="text-xs font-bold bg-zinc-900 border border-zinc-800 text-gray-400 px-2 py-1 rounded-md min-w-[30px] text-center">
                                    {filteredLeads(status).length}
                                </span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {filteredLeads(status).map(lead => (
                                    <div key={lead.id} className="relative group transition-transform duration-200 hover:-translate-y-1">
                                        <LeadCard lead={lead} onClick={setSelectedLead} />

                                        {/* Quick Actions Overlay */}
                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 flex gap-1">
                                            <div className="bg-black/90 rounded border border-gray-700 p-1 flex gap-1 shadow-xl backdrop-blur-md">
                                                {status !== 'New' && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleStatusChange(lead.id, 'New'); }} className="p-1 hover:bg-blue-900/30 text-blue-400 rounded" title="Move to New">
                                                        <span className="sr-only">New</span>
                                                        ←
                                                    </button>
                                                )}
                                                {status !== 'Contacted' && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleStatusChange(lead.id, 'Contacted'); }} className="p-1 hover:bg-yellow-900/30 text-yellow-400 rounded" title="Move to Contacted">
                                                        <span className="sr-only">Contacted</span>
                                                        •
                                                    </button>
                                                )}
                                                {status !== 'Closed' && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleStatusChange(lead.id, 'Closed'); }} className="p-1 hover:bg-green-900/30 text-green-400 rounded" title="Move to Closed">
                                                        <span className="sr-only">Closed</span>
                                                        →
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {filteredLeads(status).length === 0 && (
                                    <div className="h-32 flex flex-col items-center justify-center text-gray-700 border-2 border-dashed border-gray-900 rounded-lg m-2">
                                        <span className="text-sm font-mono uppercase">Empty</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {leads.map(lead => (
                        <LeadCard key={lead.id} lead={lead} onClick={setSelectedLead} />
                    ))}
                </div>
            )}

            {selectedLead && (
                <LeadDetailModal
                    lead={selectedLead}
                    onClose={() => setSelectedLead(null)}
                // Pass update handler to modal if supported, otherwise just close
                />
            )}
        </div>
    );
}
