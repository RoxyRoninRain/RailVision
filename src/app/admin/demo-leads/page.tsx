import { createClient } from '@/lib/supabase/server';
import { ExternalLink, Calendar, Mail, User, Palette } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DemoLeadsPage() {
    const supabase = await createClient();

    // Fetch leads for the specific organization
    const { data: leads, error } = await supabase
        .from('leads')
        .select('*')
        .eq('organization_id', 'd899bbe8-10b5-4ee7-8ee5-5569e415178f')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching demo leads:', error);
        return <div className="p-8 text-red-500">Failed to load demo leads.</div>;
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
        });
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-red-500/30">
            {/* TOP BAR */}
            <header className="border-b border-white/10 bg-[#0a0a0a] mb-8">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                        <h1 className="text-xl font-mono font-bold tracking-tight text-white">
                            DEMO LEADS <span className="text-gray-600">ANALYTICS</span>
                        </h1>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
                        <span>SOURCE: LANDING PAGE</span>
                        <span>{leads?.length || 0} RECORDS</span>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 pb-12">
                <div className="bg-[#0a0a0a] rounded-lg border border-white/5 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#111] text-gray-400 border-b border-white/5">
                            <tr>
                                <th className="p-4 pl-6 font-mono uppercase text-[10px] tracking-widest font-semibold text-gray-500">Date</th>
                                <th className="p-4 font-mono uppercase text-[10px] tracking-widest font-semibold text-gray-500">Customer</th>
                                <th className="p-4 font-mono uppercase text-[10px] tracking-widest font-semibold text-gray-500">Style</th>
                                <th className="p-4 font-mono uppercase text-[10px] tracking-widest font-semibold text-gray-500">Generated Design</th>
                                <th className="p-4 pr-6 font-mono uppercase text-[10px] tracking-widest font-semibold text-gray-500 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {leads?.map((lead) => (
                                <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="p-4 pl-6">
                                        <div className="flex items-center gap-2 text-gray-400 font-mono text-xs">
                                            <Calendar size={14} className="text-gray-600" />
                                            {formatDate(lead.created_at)}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2 text-sm font-bold text-white">
                                                <User size={14} className="text-gray-600" />
                                                {lead.customer_name || <span className="text-gray-600 italic">Unknown Name</span>}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                                                <Mail size={12} />
                                                {lead.email || <span className="italic">Anonymous</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-300">
                                            <Palette size={14} className="text-purple-500" />
                                            {lead.style_name || 'N/A'}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        {lead.generated_design_url ? (
                                            <div className="group/image relative w-16 h-16 rounded bg-black border border-gray-800 overflow-hidden cursor-pointer">
                                                <img
                                                    src={lead.generated_design_url}
                                                    alt="Generated"
                                                    className="w-full h-full object-cover group-hover/image:opacity-75 transition-opacity"
                                                />
                                                <a
                                                    href={lead.generated_design_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity bg-black/50"
                                                >
                                                    <ExternalLink size={16} className="text-white" />
                                                </a>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-600 font-mono">NO IMAGE</span>
                                        )}
                                    </td>
                                    <td className="p-4 pr-6 text-right">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono tracking-wider font-bold uppercase
                                            ${lead.status === 'New' ? 'bg-green-900/10 text-green-500 border border-green-900/20' :
                                                lead.status === 'Contacted' ? 'bg-yellow-900/10 text-yellow-500 border border-yellow-900/20' :
                                                    'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                                            {lead.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {(!leads || leads.length === 0) && (
                                <tr>
                                    <td colSpan={5} className="p-16 text-center text-gray-600 font-mono italic">
                                        No leads found for the demo yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}
