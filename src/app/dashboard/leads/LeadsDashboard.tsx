'use client';

import { useState } from 'react';
import { Lead } from '@/app/actions';
import { LeadCard } from '@/components/dashboard/LeadCard';
import { LeadDetailModal } from '@/components/dashboard/LeadDetailModal';

// Mock data (if server data is empty for dev)
// In real app, we pass data from Server Component
interface LeadsPageProps {
    leads: Lead[];
}

export default function LeadsDashboard({ initialLeads }: { initialLeads: Lead[] }) {
    const [leads] = useState<Lead[]>(initialLeads);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

    const handleExport = () => {
        // Flatten for CSV
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

    return (
        <div className="min-h-screen bg-[#0a0a0a] p-8 text-white">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-mono text-[var(--primary)]">RailVision Dashboard</h1>
                    <p className="text-gray-500">Manage your leads and estimates</p>
                </div>
                <button
                    onClick={handleExport}
                    className="border border-[var(--primary)] text-[var(--primary)] px-4 py-2 hover:bg-[var(--primary)] hover:text-black transition-colors"
                >
                    Download CSV
                </button>
            </div>

            {leads.length === 0 ? (
                <div className="text-center py-20 bg-[#111] rounded border border-gray-800">
                    <p className="text-gray-500">No leads found. Start sharing your design studio link!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {leads.map(lead => (
                        <LeadCard key={lead.id} lead={lead} onClick={setSelectedLead} />
                    ))}
                </div>
            )}

            {selectedLead && (
                <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
            )}
        </div>
    );
}
