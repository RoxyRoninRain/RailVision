'use client';

import { useEffect, useState } from 'react';
import { getAdminStats } from '@/app/actions';
import { getGlobalStats, GlobalStats } from '@/app/admin/actions';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { TrendingUp, Users, DollarSign, Activity } from 'lucide-react';

export default function AdminStatsPage() {
    const [data, setData] = useState<{ organization_id: string, count: number }[]>([]);
    const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            getAdminStats(),
            getGlobalStats()
        ]).then(([stats, globals]) => {
            setData(stats);
            setGlobalStats(globals);
            setLoading(false);
        });
    }, []);

    // Mock enhancement: convert organization_id to names if possible or just show ID
    const chartData = data.map((item, index) => ({
        ...item,
        name: `Shop ${index + 1} (${item.organization_id.substring(0, 4)})`,
        fullId: item.organization_id
    }));

    const totalLeads = data.reduce((acc, curr) => acc + curr.count, 0);
    const totalRevenue = totalLeads * 2000;
    const activeShops = data.length;

    const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#9333ea'];

    if (loading) return <div className="p-12 text-center font-mono text-gray-500 animate-pulse">Initializing Command Center...</div>;

    return (
        <div className="min-h-screen bg-[#050505] p-6 text-white font-sans">
            <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-900 pb-6">
                <div>
                    <h1 className="text-4xl font-mono font-bold text-[var(--primary)] uppercase tracking-tighter mb-1">
                        Global Overwatch
                    </h1>
                    <p className="text-gray-500 font-light text-sm tracking-wide uppercase">System Metrics & Performance</p>
                </div>
                <div className="flex gap-2">
                    <span className="bg-green-900/30 text-green-400 border border-green-900 px-3 py-1 rounded font-mono text-xs flex items-center gap-2">
                        <Activity size={14} /> SYSTEM ONLINE
                    </span>
                </div>
            </header>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <MetricCard
                    label="Total Leads Processed"
                    value={totalLeads.toString()}
                    icon={<TrendingUp size={20} className="text-blue-500" />}
                    trend="+12% this week"
                />
                <MetricCard
                    label="Active Tenants"
                    value={activeShops.toString()}
                    icon={<Users size={20} className="text-purple-500" />}
                    trend="Stable"
                />
                <MetricCard
                    label="Est. Pipeline Value"
                    value={`$${totalRevenue.toLocaleString()}`}
                    icon={<DollarSign size={20} className="text-green-500" />}
                    trend="Based on $2k avg"
                />
                <MetricCard
                    label="AI Generations"
                    value={globalStats?.totalGenerations?.toString() || '0'}
                    icon={<Activity size={20} className="text-orange-500" />}
                    trend="Actual Usage"
                />
                <MetricCard
                    label="Est. API Costs"
                    value={`$${globalStats?.estimatedApiCost?.toFixed(2) || '0.00'}`}
                    icon={<DollarSign size={20} className="text-red-500" />}
                    trend="$0.04 / gen"
                />
                <MetricCard
                    label="Active Users (IP)"
                    value={globalStats?.uniqueIps?.toString() || '0'}
                    icon={<Users size={20} className="text-purple-500" />}
                    trend="Unique Devices"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 1. TOP STYLES */}
                <div className="bg-[#111] border border-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-white mb-4 font-mono uppercase tracking-wider flex items-center gap-2">
                        <Activity size={16} className="text-purple-500" /> Most Popular Styles
                    </h3>
                    <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                        {(globalStats?.topStyles?.length || 0) > 0 ? globalStats?.topStyles.map((style: any, i: number) => (
                            <div key={style.name} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-mono text-gray-600 w-4">0{i + 1}</span>
                                    <span className="text-sm text-gray-300 font-mono group-hover:text-white transition-colors capitalize">{style.name.replace('-', ' ')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-purple-600 rounded-full"
                                            style={{ width: `${(style.count / (globalStats?.totalGenerations || 1)) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-bold text-white w-8 text-right">{style.count}</span>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-8 text-gray-600 font-mono text-xs">NO STYLE DATA YET</div>
                        )}
                    </div>
                </div>

                {/* 2. MARKET SHARE (Existing) */}
                {/* Main Bar Chart */}
                <div className="lg:col-span-2 bg-[#0a0a0a] p-6 rounded-lg border border-gray-800 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-50">
                        <Activity className="text-gray-800 w-24 h-24 absolute -top-4 -right-4" />
                    </div>
                    <h2 className="text-xl font-mono font-bold text-gray-200 mb-6 relative z-10 flex items-center gap-2">
                        Leads Distribution by Shop
                    </h2>
                    <div className="h-[350px] w-full relative z-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    stroke="#444"
                                    tick={{ fontSize: 12, fontFamily: 'monospace' }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#444"
                                    tick={{ fontSize: 12, fontFamily: 'monospace' }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    cursor={{ fill: '#ffffff05' }}
                                    contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '4px' }}
                                    itemStyle={{ color: '#fff', fontFamily: 'monospace' }}
                                />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Secondary/Pie Chart Placeholders */}
                <div className="bg-[#0a0a0a] p-6 rounded-lg border border-gray-800 shadow-2xl flex flex-col">
                    <h2 className="text-xl font-mono font-bold text-gray-200 mb-6">Market Share</h2>
                    <div className="flex-1 min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="count"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.5)" />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '4px' }}
                                    itemStyle={{ color: '#fff', fontFamily: 'monospace' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                        {chartData.map((entry, index) => (
                            <div key={index} className="flex items-center justify-between text-xs font-mono text-gray-500 p-2 hover:bg-white/5 rounded">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                    <span className="truncate max-w-[120px]" title={entry.name}>{entry.name}</span>
                                </div>
                                <span className="text-white">{entry.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ label, value, icon, trend }: { label: string, value: string, icon: React.ReactNode, trend: string }) {
    return (
        <div className="bg-[#0a0a0a] p-5 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors group">
            <div className="flex justify-between items-start mb-4">
                <span className="text-gray-500 font-mono text-xs uppercase tracking-wider">{label}</span>
                <div className="p-2 bg-gray-900 rounded-lg group-hover:bg-gray-800 transition-colors">
                    {icon}
                </div>
            </div>
            <div className="text-3xl font-bold font-mono text-white mb-2">{value}</div>
            <div className="text-xs text-gray-600 font-mono">{trend}</div>
        </div>
    )
}
