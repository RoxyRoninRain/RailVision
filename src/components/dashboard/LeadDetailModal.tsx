import { useRef, useEffect } from 'react';
import { Lead, markLeadOpened, updateLeadStatus } from '@/app/actions';

interface LeadDetailModalProps {
    lead: Lead | null;
    onClose: () => void;
    onUpdate: (lead: Lead) => void;
}

export function LeadDetailModal({ lead, onClose, onUpdate }: LeadDetailModalProps) {
    const hasMarkedOpened = useRef(false);

    useEffect(() => {
        if (lead && lead.status === 'New' && !hasMarkedOpened.current) {
            hasMarkedOpened.current = true;
            markLeadOpened(lead.id).then(() => {
                onUpdate({ ...lead, status: 'Pending' });
            });
        }
    }, [lead, onUpdate]);

    if (!lead) return null;

    const handleStatusChange = async (newStatus: any) => {
        if (newStatus === lead.status) return;
        const res = await updateLeadStatus(lead.id, newStatus);
        if (res.success) {
            onUpdate({ ...lead, status: newStatus });
        } else {
            alert('Failed to update status');
        }
    };

    const estimate = lead.estimate_json || { base_price: 0, travel_fee: 0, addons: [], total: 0 };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-[#1a1a1a] w-full max-w-5xl h-[80vh] rounded-lg border border-gray-700 flex overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Left: Images */}
                <div className="w-1/2 bg-black flex flex-col items-center justify-start p-4 border-r border-gray-800 overflow-y-auto">
                    {/* Main generated image */}
                    <div className="space-y-4 w-full mb-6">
                        <div className="aspect-video bg-[#111] rounded overflow-hidden relative border border-gray-800">
                            {lead.generated_design_url ? (
                                <img src={lead.generated_design_url} className="w-full h-full object-contain" alt="After" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500">No After Image</div>
                            )}
                            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1">AFTER</div>
                        </div>
                        <p className="text-center text-gray-400 text-sm">Reviewing design for {lead.customer_name}</p>
                    </div>

                    {/* Customer Uploads */}
                    {lead.attachments && lead.attachments.length > 0 && (
                        <div className="w-full">
                            <h3 className="text-gray-500 text-xs font-mono uppercase tracking-widest mb-3">Customer Uploads</h3>
                            <div className="grid grid-cols-3 gap-2">
                                {lead.attachments.map((url, i) => (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="aspect-square border border-gray-800 rounded overflow-hidden hover:border-[var(--primary)] transition-all relative group">
                                        <img src={url} alt={`Upload ${i + 1}`} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Data */}
                <div className="w-1/2 p-8 overflow-y-auto">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-1">{lead.customer_name}</h2>
                            <p className="text-gray-400 cursor-pointer hover:text-[var(--primary)]">{lead.email}</p>
                        </div>
                        <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
                    </div>

                    <div className="mb-8">
                        <h3 className="text-[var(--primary)] text-sm uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">Specification</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500 block">Style</span>
                                <span className="text-white">{lead.style_name}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block">Date</span>
                                <span className="text-white">{new Date(lead.created_at).toISOString().split('T')[0]}</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-[var(--primary)] text-sm uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">Estimate Breakdown</h3>
                        <div className="bg-[#222] rounded p-4 text-sm space-y-2">
                            {/* Format A: Range Estimate (Current) */}
                            {estimate.min !== undefined && (
                                <>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Estimated Range</span>
                                        <span className="text-white font-bold text-lg">
                                            ${estimate.min?.toLocaleString()} - ${estimate.max?.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Project Size</span>
                                        <span className="text-white">{estimate.linearFeet} ft</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Zip Code</span>
                                        <span className="text-white">{estimate.zipCode || 'N/A'}</span>
                                    </div>
                                    {estimate.distance > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Distance</span>
                                            <span className="text-white">{estimate.distance.toFixed(1)} miles</span>
                                        </div>
                                    )}
                                </>
                            )}
                            {/* Format B: Detailed Breakdown (Legacy/Future) - omitted for brevity if mostly unused, or kept if needed. Keeping simple for now */}
                            {!estimate.min && !estimate.base_price && (
                                <p className="text-gray-500 italic text-center">No estimate details available.</p>
                            )}
                        </div>
                    </div>

                    <div className="mt-8">
                        <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-2">Lead Status</label>
                        <select
                            value={lead.status}
                            onChange={(e) => handleStatusChange(e.target.value)}
                            className="w-full bg-[#111] border border-gray-700 text-white p-3 rounded focus:border-[var(--primary)] outline-none"
                        >
                            <option value="New">New</option>
                            <option value="Pending">Pending</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Sold">Sold</option>
                            <option value="Backed Out">Backed Out</option>
                            <option value="On Hold">On Hold</option>
                            <option value="Closed">Closed</option>
                        </select>
                    </div>

                    <div className="mt-4 flex gap-4">
                        <button className="flex-1 bg-[var(--primary)] text-black py-3 rounded font-bold hover:brightness-110">
                            Create Invoice
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
