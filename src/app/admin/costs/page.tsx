'use client';

import { useState, useEffect } from 'react';
import { getCostAnalysis } from '../actions';
import { ArrowLeft, RefreshCw, DollarSign, Image as ImageIcon, Cpu, TrendingUp, X, Calendar } from 'lucide-react';

import { startOfMonth, startOfYear } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function CostDashboard() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [timeFilter, setTimeFilter] = useState('7d'); // Default to 7 days
    const [dateRange, setDateRange] = useState<{ from: string, to: string }>({ from: '', to: '' });
    const [showCustomPicker, setShowCustomPicker] = useState(false);

    useEffect(() => {
        loadData(timeFilter);
    }, [timeFilter]);

    // Debounce custom range reload
    useEffect(() => {
        if (timeFilter === 'custom' && dateRange.from && dateRange.to) {
            loadData('custom');
        }
    }, [dateRange]);

    const loadData = async (filter: string) => {
        setLoading(true);
        try {
            let range: { from?: string, to?: string } | undefined;
            let groupBy: 'day' | 'week' | 'month' | 'year' = 'day';
            const now = new Date();

            switch (filter) {
                case '24h':
                    range = { from: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString() };
                    groupBy = 'day';
                    break;
                case '7d':
                    range = { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString() };
                    groupBy = 'day';
                    break;
                case '30d':
                    range = { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString() };
                    groupBy = 'day';
                    break;
                case 'mtd':
                    range = { from: startOfMonth(now).toISOString() };
                    groupBy = 'day';
                    break;
                case '365d':
                    range = { from: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString() };
                    groupBy = 'month';
                    break;
                case 'ytd':
                    range = { from: startOfYear(now).toISOString() };
                    groupBy = 'month';
                    break;
                case 'all_months':
                    // All time, grouped by month
                    range = undefined;
                    groupBy = 'month';
                    break;
                case 'all_years':
                    // All time, grouped by year
                    range = undefined;
                    groupBy = 'year';
                    break;
                case 'all':
                    range = undefined;
                    groupBy = 'month';
                    break;
                case 'custom':
                    if (!dateRange.from && !dateRange.to) {
                        setLoading(false);
                        return;
                    }
                    range = { from: dateRange.from ? new Date(dateRange.from).toISOString() : undefined, to: dateRange.to ? new Date(dateRange.to).toISOString() : undefined };
                    groupBy = 'day'; // Default custom to day for now
                    break;
                default:
                    range = undefined;
            }

            const result = await getCostAnalysis(range, groupBy);
            setData(result);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !data) {
        return (
            <div className="min-h-screen bg-black text-white p-8 animate-pulse">
                <div className="h-8 w-48 bg-gray-800 rounded mb-8"></div>
                <div className="grid grid-cols-3 gap-6">
                    <div className="h-64 bg-gray-800 rounded-xl col-span-3"></div>
                    <div className="h-32 bg-gray-800 rounded-xl"></div>
                    <div className="h-32 bg-gray-800 rounded-xl"></div>
                    <div className="h-32 bg-gray-800 rounded-xl"></div>
                </div>
            </div>
        );
    }

    if (data?.error) {
        return <div className="text-red-500 p-8">Error: {data.error}</div>;
    }

    const { totalCost, totalGenerations, totalInputTokens, totalOutputTokens, modelBreakdown, chartData } = data;
    const costPerImage = totalGenerations > 0 ? (totalCost / totalGenerations).toFixed(4) : '0.0000';

    const formatTokens = (tokens: number) => {
        if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
        if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
        return tokens.toLocaleString();
    };

    // Gemini 3 Stats
    const geminiStats = modelBreakdown['gemini-3.0-pro-image-preview'] || { count: 0, cost: 0, inputTokens: 0, outputTokens: 0, inputCost: 0, outputCost: 0, imageCost: 0 };

    const FilterTab = ({ label, value }: { label: string, value: string }) => (
        <button
            onClick={() => {
                if (value === 'custom') {
                    setShowCustomPicker(!showCustomPicker);
                } else {
                    setTimeFilter(value);
                    setShowCustomPicker(false);
                }
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${timeFilter === value
                ? 'bg-white text-black font-bold'
                : 'bg-transparent text-gray-500 hover:text-white hover:bg-white/10'
                }`}
        >
            {label}
        </button>
    );

    return (
        <div className="min-h-screen bg-black text-white p-8 font-sans">
            <header className="mb-8 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/stats" className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <DollarSign className="text-green-500" /> Cost Intelligence
                            </h1>
                            <p className="text-gray-400 text-sm">Analyze API spend and profitability</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 p-1 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                        <FilterTab label="24h" value="24h" />
                        <FilterTab label="7 Days" value="7d" />
                        <FilterTab label="30 Days" value="30d" />
                        <FilterTab label="All Time" value="all" />
                    </div>
                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                        <FilterTab label="MTD" value="mtd" />
                        <FilterTab label="YTD" value="ytd" />
                    </div>
                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                        <FilterTab label="Months" value="all_months" />
                        <FilterTab label="Years" value="all_years" />
                    </div>
                    <div className="flex items-center gap-1 ml-auto relative">
                        <FilterTab label="Custom" value="custom" />

                        {showCustomPicker && (
                            <div className="absolute top-10 right-0 bg-[#222] border border-white/20 p-4 rounded-xl shadow-2xl z-50 w-64">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-sm font-bold text-white flex items-center gap-2">
                                        <Calendar size={14} /> Select Range
                                    </span>
                                    <button onClick={() => setShowCustomPicker(false)} className="text-gray-400 hover:text-white">
                                        <X size={14} />
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1 block">Start Date</label>
                                        <input
                                            type="date"
                                            className="w-full bg-black border border-white/10 text-white text-xs p-2 rounded outline-none font-mono [color-scheme:dark] focus:border-white/30 transition-colors"
                                            value={dateRange.from}
                                            onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1 block">End Date</label>
                                        <input
                                            type="date"
                                            className="w-full bg-black border border-white/10 text-white text-xs p-2 rounded outline-none font-mono [color-scheme:dark] focus:border-white/30 transition-colors"
                                            value={dateRange.to}
                                            onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (timeFilter !== 'custom') setTimeFilter('custom');
                                            setShowCustomPicker(false);
                                            // Ensure data loads if already custom but different range
                                            if (timeFilter === 'custom') loadData('custom');
                                        }}
                                        className="w-full bg-white text-black text-xs font-bold py-2 rounded hover:bg-gray-200 transition-colors"
                                    >
                                        Apply Range
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* MAIN STATS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                {/* Total Spend */}
                <div className="bg-[#111] border border-white/10 p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-gray-400 text-sm font-medium">Total Spend</span>
                        <div className="p-2 bg-green-500/10 text-green-500 rounded-lg">
                            <DollarSign size={20} />
                        </div>
                    </div>
                    <div className="text-4xl font-bold font-mono">${totalCost.toFixed(2)}</div>
                    <div className="text-xs text-gray-500 mt-2">
                        {timeFilter === 'all' ? 'All time' : `Last ${timeFilter}`}
                    </div>
                </div>

                {/* Avg Cost / Image */}
                <div className="bg-[#111] border border-white/10 p-6 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <ImageIcon size={100} />
                    </div>
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-gray-400 text-sm font-medium">Avg Cost / Image</span>
                        <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                            <TrendingUp size={20} />
                        </div>
                    </div>
                    <div className="text-4xl font-bold font-mono">${costPerImage}</div>
                    <div className="text-xs text-gray-500 mt-2">Target: &lt; $0.05</div>
                </div>

                {/* Total Generations */}
                <div className="bg-[#111] border border-white/10 p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-gray-400 text-sm font-medium">Total Generations</span>
                        <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
                            <ImageIcon size={20} />
                        </div>
                    </div>
                    <div className="text-4xl font-bold font-mono">{totalGenerations}</div>
                    <div className="text-xs text-gray-500 mt-2">Across all models</div>
                </div>

                {/* Token Usage */}
                <div className="bg-[#111] border border-white/10 p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-gray-400 text-sm font-medium">Total Tokens</span>
                        <div className="p-2 bg-orange-500/10 text-orange-500 rounded-lg">
                            <Cpu size={20} />
                        </div>
                    </div>
                    <div className="text-2xl font-bold font-mono">
                        {formatTokens(totalInputTokens)} <span className="text-gray-600 text-sm">In</span>
                    </div>
                    <div className="text-2xl font-bold font-mono">
                        {formatTokens(totalOutputTokens)} <span className="text-gray-600 text-sm">Out</span>
                    </div>
                </div>
            </div>

            {/* MODEL BREAKDOWN TABLE */}
            <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-white/5">
                    <h2 className="text-lg font-bold">Model Breakdown</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-gray-400 font-medium">
                            <tr>
                                <th className="p-4">Model ID</th>
                                <th className="p-4 text-right">Generations</th>
                                <th className="p-4 text-right">Input Tokens</th>
                                <th className="p-4 text-right">Output Tokens</th>
                                <th className="p-4 text-right">Est. Cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {Object.entries(modelBreakdown)
                                .filter(([id]) => id !== 'unknown') // Filter out unknown models
                                .map(([id, stats]: [string, any]) => (
                                    <tr key={id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 font-mono text-blue-400">{id}</td>
                                        <td className="p-4 text-right">{stats.count}</td>
                                        <td className="p-4 text-right font-mono text-gray-400">{stats.inputTokens.toLocaleString()}</td>
                                        <td className="p-4 text-right font-mono text-gray-400">{stats.outputTokens.toLocaleString()}</td>
                                        <td className="p-4 text-right font-bold text-green-500">${stats.cost.toFixed(4)}</td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* COST COMPOSITION & CHARTS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                {/* 1. Visual Breakdown Chart */}
                <div className="bg-[#111] border border-white/10 p-6 rounded-2xl">
                    <h3 className="text-lg font-bold mb-6">Cost Composition (Gemini 3.0 Pro)</h3>

                    {geminiStats.count > 0 ? (
                        <div className="space-y-6">
                            {/* Stacked Bar */}
                            <div className="h-16 w-full bg-white/5 rounded-full overflow-hidden flex cursor-pointer hover:opacity-90 transition-opacity">
                                <div
                                    className="h-full bg-blue-500 flex items-center justify-center text-xs font-bold text-black"
                                    style={{ width: `${(geminiStats.inputCost / geminiStats.cost) * 100}%` }}
                                >
                                    In
                                </div>
                                <div
                                    className="h-full bg-purple-500 flex items-center justify-center text-xs font-bold text-black"
                                    style={{ width: `${(geminiStats.outputCost / geminiStats.cost) * 100}%` }}
                                >
                                    Out
                                </div>
                                <div
                                    className="h-full bg-pink-500 flex items-center justify-center text-xs font-bold text-black"
                                    style={{ width: `${(geminiStats.imageCost / geminiStats.cost) * 100}%` }}
                                >
                                    Img
                                </div>
                            </div>

                            <div className="flex justify-between text-sm text-gray-400">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                                    <span>Input ({geminiStats.cost > 0 ? ((geminiStats.inputCost / geminiStats.cost) * 100).toFixed(1) : 0}%)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                                    <span>Output ({geminiStats.cost > 0 ? ((geminiStats.outputCost / geminiStats.cost) * 100).toFixed(1) : 0}%)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-pink-500" />
                                    <span>Image Gen ({geminiStats.cost > 0 ? ((geminiStats.imageCost / geminiStats.cost) * 100).toFixed(1) : 0}%)</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-500">No generation data available yet.</p>
                    )}
                </div>

                {/* 2. Detailed Explanation Card */}
                <div className="bg-[#111] border border-white/10 p-6 rounded-2xl">
                    <h3 className="text-lg font-bold mb-4">Cost Analysis per Image</h3>
                    {geminiStats.count > 0 ? (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-400">Average breakdown based on {geminiStats.count} generations:</p>

                            <div className="p-4 bg-white/5 rounded-xl space-y-3 font-mono text-sm">
                                {/* Fixed Image Cost */}
                                <div className="flex justify-between">
                                    <span className="text-pink-400">Image Generation (Fixed)</span>
                                    <span>${(geminiStats.imageCost / geminiStats.count).toFixed(4)}</span>
                                </div>
                                <div className="text-xs text-gray-500 pl-2 border-l border-pink-500/30">
                                    Flat rate per 1k/2k image
                                </div>

                                {/* Input Math */}
                                <div className="flex justify-between pt-2 border-t border-white/5">
                                    <span className="text-blue-400">Input Processing</span>
                                    <span>${(geminiStats.inputCost / geminiStats.count).toFixed(4)}</span>
                                </div>
                                <div className="text-xs text-gray-500 pl-2 border-l border-blue-500/30">
                                    ~{Math.round(geminiStats.inputTokens / geminiStats.count).toLocaleString()} tokens @ $2.00/1M
                                </div>

                                {/* Output Math */}
                                <div className="flex justify-between pt-2 border-t border-white/5">
                                    <span className="text-purple-400">"Thinking" Output</span>
                                    <span>${(geminiStats.outputCost / geminiStats.count).toFixed(4)}</span>
                                </div>
                                <div className="text-xs text-gray-500 pl-2 border-l border-purple-500/30">
                                    ~{Math.round(geminiStats.outputTokens / geminiStats.count).toLocaleString()} tokens @ $12.00/1M
                                </div>

                                {/* Total Math */}
                                <div className="flex justify-between pt-3 border-t border-white/10 text-base font-bold text-green-400">
                                    <span>Total Average</span>
                                    <span>${(geminiStats.cost / geminiStats.count).toFixed(4)}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-500">Generate an image to see the cost breakdown.</p>
                    )}
                </div>
            </div>

            {/* CHART VISUALIZATION */}
            <div className="bg-[#111] border border-white/10 p-6 rounded-2xl mb-8">
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                            <XAxis
                                dataKey="label"
                                tick={{ fill: '#666', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                minTickGap={20}
                            />
                            <YAxis
                                tick={{ fill: '#666', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(val) => `$${val}`}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px' }}
                                itemStyle={{ color: '#fff' }}
                                formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                            />
                            <Bar dataKey="cost" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                {chartData && chartData.length === 0 && (
                    <div className="text-center text-gray-500 text-sm mt-[-150px] pointer-events-none">No data for this period</div>
                )}
            </div>

            <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-200 text-sm">
                <strong>Pricing Note:</strong> Costs are based on Gemini 3.0 Pro (Late 2025): $2.00/1M Input, $12.00/1M Output (Thinking), ~$0.134/Image.
            </div>
        </div>
    );
}
