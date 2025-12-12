'use client';

import { useState } from 'react';
import { Lead } from '@/app/actions';
import { LeadCard } from '@/components/dashboard/LeadCard';
import { LeadDetailModal } from '@/components/dashboard/LeadDetailModal';
import { updateLeadStatus } from '@/app/actions'; // Need to implement this
import { LayoutGrid, List, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
        <div className="min-h-screen bg-[#0a0a0a] p-8 text-white relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-mono text-[var(--primary)] mb-1">RailVision Dashboard</h1>
                    <p className="text-gray-500">Manage your leads and status pipeline</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setViewMode(viewMode === 'kanban' ? 'list' : 'kanban')}
                        className="p-2 border border-gray-700 rounded hover:bg-gray-800 transition-colors"
                        title="Toggle View"
                    >
                        {viewMode === 'kanban' ? <List size={20} /> : <LayoutGrid size={20} />}
                    </button>
                    <button
                        onClick={handleExport}
                        className="border border-[var(--primary)] text-[var(--primary)] px-4 py-2 hover:bg-[var(--primary)] hover:text-black transition-colors font-mono text-sm uppercase"
                    >
                        Export CSV
                    </button>
                </div>
            </div>

            {viewMode === 'kanban' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-200px)] overflow-hidden">
                    {['New', 'Contacted', 'Closed'].map((status) => (
                        <div key={status} className="flex flex-col h-full bg-[#111] border border-gray-800 rounded-lg overflow-hidden">
                            <div className={cn(
                                "p-3 border-b border-gray-800 font-mono font-bold flex justify-between items-center",
                                status === 'New' && "text-blue-400",
                                status === 'Contacted' && "text-yellow-400",
                                status === 'Closed' && "text-green-400"
                            )}>
                                {status.toUpperCase()}
                                <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full">
                                    {filteredLeads(status).length}
                                </span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {filteredLeads(status).map(lead => (
                                    <div key={lead.id} className="relative group">
                                        <LeadCard lead={lead} onClick={setSelectedLead} />
                                        {/* Quick Move Actions (Hover) */}
                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-black/80 rounded p-1 backdrop-blur-sm">
                                            {status !== 'New' && (
                                                <button onClick={(e) => { e.stopPropagation(); handleStatusChange(lead.id, 'New'); }} className="text-xs text-blue-400 hover:text-blue-300 px-1">← New</button>
                                            )}
                                            {status !== 'Contacted' && (
                                                <button onClick={(e) => { e.stopPropagation(); handleStatusChange(lead.id, 'Contacted'); }} className="text-xs text-yellow-400 hover:text-yellow-300 px-1">Contacted</button>
                                            )}
                                            {status !== 'Closed' && (
                                                <button onClick={(e) => { e.stopPropagation(); handleStatusChange(lead.id, 'Closed'); }} className="text-xs text-green-400 hover:text-green-300 px-1">Closed →</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {filteredLeads(status).length === 0 && (
                                    <div className="text-center py-10 opacity-30 italic">
                                        No leads
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
