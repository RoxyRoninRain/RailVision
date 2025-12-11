import { getAdminStats } from '@/app/actions';

export default async function AdminStatsPage() {
    const stats = await getAdminStats();

    return (
        <div className="min-h-screen bg-black text-white p-8">
            <h1 className="text-3xl text-red-500 mb-8 font-mono">SUPER ADMIN / STATS</h1>

            <div className="max-w-4xl bg-[#111] border border-gray-800 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[#222] text-gray-400 uppercase text-sm">
                        <tr>
                            <th className="p-4">Organization ID</th>
                            <th className="p-4 text-right">Lead Count</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {stats.map((stat: any) => (
                            <tr key={stat.organization_id} className="hover:bg-white/5">
                                <td className="p-4 font-mono text-sm text-[var(--primary)]">{stat.organization_id}</td>
                                <td className="p-4 text-right font-bold">{stat.count}</td>
                            </tr>
                        ))}
                        {stats.length === 0 && (
                            <tr>
                                <td colSpan={2} className="p-8 text-center text-gray-600">No data available</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
