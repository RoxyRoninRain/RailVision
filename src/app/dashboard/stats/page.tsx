'use client';

import { useState, useEffect } from 'react';
import { getDeepStats } from '@/app/actions';
import { BarChart3, TrendingUp, Users, MousePointerClick, Calendar, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts';

export default function StatsPage() {
    const [range, setRange] = useState<'7d' | '30d' | 'mtd' | 'ytd' | 'all'>('30d');
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        getDeepStats(range).then(data => {
            setStats(data);
            setLoading(false);
        });
    }, [range]);

    const ranges = [
        { label: '7 Days', value: '7d' },
        { label: '30 Days', value: '30d' },
        { label: 'Month to Date', value: 'mtd' },
        { label: 'Year to Date', value: 'ytd' },
        { label: 'All Time', value: 'all' },
    ];

    if (!stats && !loading) return <div className="p-8 text-gray-500">Failed to load stats.</div>;

    return (
        <div className="min-h-screen bg-[#050505] p-4 md:p-8 text-white font-sans">
            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6 border-b border-gray-900 pb-6">
                <div>
                    <h1 className="text-4xl font-mono font-bold text-[var(--primary)] uppercase tracking-tighter mb-2">
                        Performance Analytics
                    </h1>
                    <p className="text-gray-500 font-light">Track visualizer usage, quotes, and sales performance.</p>
                </div>
                <div className="flex bg-[#111] p-1 rounded-lg border border-gray-800 overflow-x-auto max-w-full">
                    {ranges.map(r => (
                        <button
                            key={r.value}
                            onClick={() => setRange(r.value as any)}
                            className={`px-4 py-2 text-xs font-mono uppercase tracking-wider rounded transition-all whitespace-nowrap ${range === r.value
                                ? 'bg-[var(--primary)] text-black font-bold shadow-lg'
                                : 'text-gray-500 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
                </div>
            ) : (
                <>
                    {/* Stat Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                        <div className="bg-[#111] border border-gray-800 p-6 rounded-lg relative overflow-hidden group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                                    <MousePointerClick size={24} />
                                </div>
                                <span className={`text-xs font-mono uppercase px-2 py-1 rounded bg-zinc-900 text-gray-400`}>
                                    Generations
                                </span>
                            </div>
                            <h3 className="text-3xl font-bold text-white mb-1">{stats.totalGenerations}</h3>
                            <p className="text-sm text-gray-500">Visualizer Usage</p>
                        </div>

                        <div className="bg-[#111] border border-gray-800 p-6 rounded-lg relative overflow-hidden group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-[var(--primary)]/10 rounded-lg text-[var(--primary)]">
                                    <Calendar size={24} />
                                </div>
                                <span className="text-xs font-mono uppercase px-2 py-1 rounded bg-zinc-900 text-gray-400">
                                    Quotes
                                </span>
                            </div>
                            <h3 className="text-3xl font-bold text-white mb-1">{stats.totalQuotes}</h3>
                            <p className="text-sm text-gray-500">Requests Received</p>
                        </div>

                        <div className="bg-[#111] border border-gray-800 p-6 rounded-lg relative overflow-hidden group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500">
                                    <Download size={24} />
                                </div>
                                <span className="text-xs font-mono uppercase px-2 py-1 rounded bg-zinc-900 text-gray-400">
                                    Downloads
                                </span>
                            </div>
                            <h3 className="text-3xl font-bold text-white mb-1">{stats.totalDownloads}</h3>
                            <p className="text-sm text-gray-500">Designs Saved</p>
                        </div>

                        <div className="bg-[#111] border border-gray-800 p-6 rounded-lg relative overflow-hidden group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
                                    <TrendingUp size={24} />
                                </div>
                                <span className="text-xs font-mono uppercase px-2 py-1 rounded bg-zinc-900 text-gray-400">
                                    Sales
                                </span>
                            </div>
                            <h3 className="text-3xl font-bold text-white mb-1">{stats.salesCount}</h3>
                            <p className="text-sm text-gray-500">
                                Conversion: <span className="text-white font-bold">{stats.conversionRate}%</span>
                            </p>
                        </div>

                        <div className="bg-[#111] border border-gray-800 p-6 rounded-lg relative overflow-hidden group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
                                    <Users size={24} />
                                </div>
                                <span className="text-xs font-mono uppercase px-2 py-1 rounded bg-zinc-900 text-gray-400">
                                    Popular
                                </span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-1 truncate" title={stats.topStyle}>
                                {stats.topStyle}
                            </h3>
                            <p className="text-sm text-gray-500">Top Style</p>
                        </div>
                    </div>

                    {/* Charts grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
                        {/* Line Chart: Quote vs Sales */}
                        <div className="bg-[#111] border border-gray-800 p-6 rounded-lg">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <TrendUpIcon /> Quote Volume & Sales
                            </h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={stats.chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#666"
                                            fontSize={12}
                                            tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                                        />
                                        <YAxis stroke="#666" fontSize={12} allowDecimals={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }}
                                            itemStyle={{ color: '#fff' }}
                                            labelStyle={{ color: '#888' }}
                                        />
                                        <Line type="monotone" dataKey="quotes" stroke="var(--primary)" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="Quotes" />
                                        <Line type="monotone" dataKey="downloads" stroke="#eab308" strokeWidth={2} dot={false} name="Downloads" />
                                        <Line type="monotone" dataKey="sales" stroke="#22c55e" strokeWidth={2} dot={false} name="Sales" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Bar Chart: Usage */}
                        <div className="bg-[#111] border border-gray-800 p-6 rounded-lg">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <BarChart3Icon /> Tool Usage
                            </h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#666"
                                            fontSize={12}
                                            tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                                        />
                                        <YAxis stroke="#666" fontSize={12} allowDecimals={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }}
                                            cursor={{ fill: '#ffffff10' }}
                                            itemStyle={{ color: '#fff' }}
                                            labelStyle={{ color: '#888' }}
                                        />
                                        <Bar dataKey="generations" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Generations" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

const TrendUpIcon = () => <TrendingUp className="text-gray-500" size={18} />;
const BarChart3Icon = () => <BarChart3 className="text-gray-500" size={18} />;
