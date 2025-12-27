'use client';

import { useState, useEffect } from 'react';
import { getSecurityActivity, getTenantBlockedIps, blockVisitor, unblockVisitor } from '@/app/admin/actions/security';
import { ShieldAlert, Activity, Search } from 'lucide-react';

export default function SecurityPage() {
    const [activity, setActivity] = useState<any[]>([]);
    const [blockedIps, setBlockedIps] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = async () => {
        setLoading(true);
        const [logs, blocks] = await Promise.all([
            getSecurityActivity(),
            getTenantBlockedIps()
        ]);
        setActivity(logs);
        setBlockedIps(blocks);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleBlock = async (ip: string) => {
        if (!confirm(`Are you sure you want to block IP: ${ip}? This will prevent them from using the tool on your site.`)) return;

        const res = await blockVisitor(ip);
        if (res.success) {
            alert('IP Blocked successfully');
            fetchData();
        } else {
            alert(res.error || 'Failed to block IP');
        }
    };

    const handleUnblock = async (ip: string) => {
        const res = await unblockVisitor(ip);
        if (res.success) {
            alert('IP Unblocked successfully');
            fetchData();
        } else {
            alert(res.error || 'Failed to unblock IP');
        }
    };

    // Derived state
    const blockedSet = new Set(blockedIps.map(b => b.ip_address));

    return (
        <div className="min-h-screen bg-[#050505] p-6 md:p-8 text-white font-sans">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6 border-b border-gray-900 pb-6">
                <div>
                    <h1 className="text-4xl font-mono font-bold text-[var(--primary)] uppercase tracking-tighter mb-2">
                        Security & Access
                    </h1>
                    <p className="text-gray-500 font-light">Monitor usage and block abusive IP addresses.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* BLOCKED LIST */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-[#111] border border-gray-800 rounded-lg p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldAlert className="text-red-500" />
                            <h2 className="text-xl font-bold uppercase tracking-wide">Blocked IPs</h2>
                        </div>
                        {loading ? (
                            <div className="animate-pulse h-20 bg-gray-900 rounded"></div>
                        ) : blockedIps.length === 0 ? (
                            <p className="text-gray-500 text-sm">No IPs blocked.</p>
                        ) : (
                            <ul className="space-y-3">
                                {blockedIps.map(block => (
                                    <li key={block.id} className="bg-zinc-900/50 border border-red-900/30 p-3 rounded flex justify-between items-center group">
                                        <div>
                                            <div className="font-mono text-sm text-red-200">{block.ip_address}</div>
                                            <div className="text-xs text-gray-500">{new Date(block.created_at).toLocaleDateString()}</div>
                                        </div>
                                        <button
                                            onClick={() => handleUnblock(block.ip_address)}
                                            className="text-xs bg-red-900/20 hover:bg-red-900/40 text-red-400 px-2 py-1 rounded transition-colors"
                                        >
                                            Unblock
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* ACTIVITY LOG */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-[#111] border border-gray-800 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Activity className="text-[var(--primary)]" />
                                <h2 className="text-xl font-bold uppercase tracking-wide">Recent Activity</h2>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Filter IP..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="bg-zinc-900 border border-zinc-800 rounded-full pl-9 pr-4 py-1 text-sm text-gray-300 focus:border-[var(--primary)] outline-none"
                                />
                            </div>
                        </div>

                        {loading ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-900 rounded animate-pulse"></div>)}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-gray-400">
                                    <thead className="text-xs uppercase bg-zinc-900/50 text-gray-500">
                                        <tr>
                                            <th className="px-4 py-3 rounded-l">Time</th>
                                            <th className="px-4 py-3">IP Address</th>
                                            <th className="px-4 py-3">Action</th>
                                            <th className="px-4 py-3 rounded-r text-right">Block</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800">
                                        {activity
                                            .filter(log => log.ip_address.includes(searchTerm))
                                            .map(log => {
                                                const isBlocked = blockedSet.has(log.ip_address);
                                                return (
                                                    <tr key={log.id} className="hover:bg-zinc-900/30 transition-colors">
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            {new Date(log.created_at).toLocaleString()}
                                                        </td>
                                                        <td className="px-4 py-3 font-mono text-gray-300">
                                                            {log.ip_address}
                                                            {isBlocked && <span className="ml-2 text-[10px] bg-red-900/50 text-red-400 px-1 rounded">BLOCKED</span>}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            Generation
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            {!isBlocked ? (
                                                                <button
                                                                    onClick={() => handleBlock(log.ip_address)}
                                                                    className="text-xs border border-zinc-700 hover:border-red-500 hover:text-red-500 px-3 py-1 rounded transition-colors"
                                                                >
                                                                    Block
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleUnblock(log.ip_address)}
                                                                    className="text-xs text-gray-600 cursor-not-allowed px-3 py-1"
                                                                    disabled
                                                                >
                                                                    Blocked
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                                {activity.length === 0 && <div className="p-8 text-center text-gray-600">No recent activity log found.</div>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
