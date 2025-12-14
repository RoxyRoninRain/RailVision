'use client';

import { useEffect, useState } from 'react';
import { getAdminStats } from '@/app/actions';
import { getGlobalStats, GlobalStats, getCostAnalysis } from '@/app/admin/actions';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { TrendingUp, Users, DollarSign, Activity, Building, Zap } from 'lucide-react';

export default function AdminStatsPage() {
    const [stats, setStats] = useState<any>(null);
    const [costs, setCosts] = useState<any>(null);
    const [chartData, setChartData] = useState<any[]>([]);

    useEffect(() => {
        const loadStats = async () => {
            const [adminData, globalData, costData] = await Promise.all([
                getAdminStats(),
                getGlobalStats(),
                getCostAnalysis()
            ]);

            setStats(globalData);
            setCosts(costData);

            // Accessing count from adminData properly
            const formattedChartData = adminData.map((item: any, index: number) => ({
                ...item,
                name: `Shop ${index + 1} (${item.organization_id.substring(0, 4)})`,
                fullId: item.organization_id
            }));
            setChartData(formattedChartData);
        };
        loadStats();
    }, []);

    if (!stats || !costs) return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-2 border-red-500 rounded-full border-t-transparent"></div>
        </div>
    );

    const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#9333ea'];

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-red-500/30 p-8">
            <header className="mb-12 border-b border-white/10 pb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">Platform Intelligence</h1>
                        <p className="text-gray-400 font-mono text-xs tracking-widest">REAL-TIME ANALYTICS & COST TRACKING</p>
                    </div>
                    <div className="flex gap-2">
                        <span className="bg-green-900/30 text-green-400 border border-green-900 px-3 py-1 rounded font-mono text-xs flex items-center gap-2">
                            <Activity size={14} /> SYSTEM ONLINE
                        </span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <StatCard
                    label="Total Leads"
                    value={stats.totalLeads}
                    icon={<Users size={16} />}
                    trend="+12% (30d)"
                />
                <StatCard
                    label="Active Shops"
                    value={stats.activeTenants}
                    icon={<Building size={16} />}
                />
                <StatCard
                    label="Generations"
                    value={stats.totalGenerations}
                    icon={<Zap size={16} />}
                    trend="Alive"
                />
                <StatCard
                    isCost
                    label="Total AI Spend"
                    value={`$${costs.totalCost?.toFixed(2) || '0.00'}`}
                    icon={<DollarSign size={16} />}
                    subtext="High Precision Tracker"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* COST BREAKDOWN */}
                <div className="lg:col-span-2 bg-[#111] border border-white/10 rounded-lg p-6">
                    <h3 className="text-sm font-mono text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <DollarSign size={14} /> Cost Breakdown by Model
                    </h3>

                    <div className="space-y-4">
                        {Object.entries(costs.modelBreakdown || {}).map(([model, data]: [string, any]) => (
                            <div key={model} className="bg-black/40 border border-white/5 rounded p-4 flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-bold text-gray-200 mb-1">{model}</div>
                                    <div className="text-xs font-mono text-gray-500">
                                        {data.count} calls • {(data.outputTokens / 1000000).toFixed(3)}M output tokens
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-mono font-bold text-red-400">${data.cost.toFixed(3)}</div>
                                    <div className="text-[10px] text-gray-600 uppercase tracking-wider">Est. Cost</div>
                                </div>
                            </div>
                        ))}
                        {(!costs.modelBreakdown || Object.keys(costs.modelBreakdown).length === 0) && (
                            <div className="text-center py-8 text-gray-600 font-mono text-xs">NO COST DATA YET</div>
                        )}
                    </div>
                </div>

                {/* TOP STYLES */}
                <div className="bg-[#111] border border-white/10 rounded-lg p-6">
                    <h3 className="text-sm font-mono text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Activity size={14} /> Popular Styles
                    </h3>
                    <div className="space-y-3">
                        {stats.topStyles.map((style: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded hover:bg-white/10 transition-colors">
                                <span className="text-sm font-medium text-gray-300">#{i + 1} {style.name}</span>
                                <span className="text-xs font-mono bg-black/50 px-2 py-1 rounded text-red-400">{style.count}</span>
                            </div>
                        ))}
                    </div>

                    {/* Market Share Chart (Mini) */}
                    <div className="h-40 mt-8">
                        <h4 className="text-xs font-mono text-gray-500 uppercase mb-4">Leads by Shop</h4>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <Tooltip
                                    cursor={{ fill: '#ffffff05' }}
                                    contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '4px' }}
                                    itemStyle={{ color: '#fff', fontFamily: 'monospace' }}
                                />
                                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon, trend, isCost, subtext }: { label: string, value: string | number, icon: any, trend?: string, isCost?: boolean, subtext?: string }) {
    return (
        <div className="bg-[#111] border border-white/10 rounded-lg p-6 hover:border-white/20 transition-all group">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${isCost ? 'bg-red-500/10 text-red-500' : 'bg-white/5 text-gray-400 group-hover:text-white transition-colors'}`}>
                    {icon}
                </div>
                {trend && (
                    <span className="text-[10px] font-mono bg-green-900/20 text-green-400 px-2 py-1 rounded border border-green-900/30">
                        {trend}
                    </span>
                )}
            </div>
            <div>
                <div className="text-gray-500 text-xs font-mono uppercase tracking-widest mb-1">{label}</div>
                <div className="text-2xl font-black text-white tracking-tight">{value}</div>
                {subtext && <div className="text-[10px] text-gray-600 mt-1 font-mono uppercase tracking-wider">{subtext}</div>}
            </div>
        </div>
    );
}
