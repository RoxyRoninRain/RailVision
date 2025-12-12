import { getAdminStats } from '@/app/actions';

export default async function TenantsPage() {
    // In real app, we would fetch profile details too. 
    // adapting getAdminStats to return basic list for now
    const stats = await getAdminStats();

    return (
        <div>
            <h1 className="text-3xl font-mono text-[var(--primary)] mb-8">Tenants (Shops)</h1>

            <div className="bg-[#111] rounded border border-gray-800 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[#1a1a1a] text-gray-400 border-b border-gray-800">
                        <tr>
                            <th className="p-4 font-mono uppercase text-sm">Organization ID</th>
                            <th className="p-4 font-mono uppercase text-sm">Leads Count</th>
                            <th className="p-4 font-mono uppercase text-sm">Status</th>
                            <th className="p-4 font-mono uppercase text-sm">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {stats.map(stat => (
                            <tr key={stat.organization_id} className="hover:bg-white/5">
                                <td className="p-4 font-mono text-sm text-gray-300">{stat.organization_id}</td>
                                <td className="p-4 font-bold text-white">{stat.count}</td>
                                <td className="p-4"><span className="text-xs bg-green-900 text-green-400 px-2 py-1 rounded">Active</span></td>
                                <td className="p-4">
                                    <button className="text-[var(--primary)] hover:underline text-sm">Manage</button>
                                </td>
                            </tr>
                        ))}
                        {stats.length === 0 && (
                            <tr><td colSpan={4} className="p-8 text-center text-gray-500">No tenants found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
