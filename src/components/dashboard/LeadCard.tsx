import { Lead } from '@/app/actions';

interface LeadCardProps {
    lead: Lead;
    onClick: (lead: Lead) => void;
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
    const statusColors = {
        'New': 'bg-green-500/20 text-green-400 border-green-500/50',
        'Contacted': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
        'Closed': 'bg-gray-500/20 text-gray-400 border-gray-500/50',
    };

    const statusClass = statusColors[lead.status] || statusColors['New'];

    return (
        <div
            onClick={() => onClick(lead)}
            className="bg-[#222] border border-gray-800 p-4 rounded-lg cursor-pointer hover:border-[#FFD700] transition-colors group"
        >
            <div className="relative aspect-video bg-black rounded mb-3 overflow-hidden">
                {lead.generated_design_url ? (
                    <img src={lead.generated_design_url} alt="Design" className="object-cover w-full h-full group-hover:scale-105 transition-transform" />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-600">No Image</div>
                )}
                <div className={`absolute top-2 right-2 px-2 py-0.5 text-xs border rounded ${statusClass}`}>
                    {lead.status}
                </div>
            </div>

            <div className="space-y-1">
                <h3 className="font-bold text-white truncate">{lead.customer_name}</h3>
                <p className="text-sm text-gray-400">{lead.style_name}</p>
                <p className="text-xs text-gray-500">{new Date(lead.created_at).toLocaleDateString()}</p>
            </div>
        </div>
    );
}
