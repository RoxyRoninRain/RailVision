'use client';

import { useState, useEffect } from 'react';
import { getCostAnalysis } from '../actions';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, DollarSign, Image as ImageIcon, Cpu, TrendingUp } from 'lucide-react';

export default function CostDashboard() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const result = await getCostAnalysis();
            setData(result);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white p-8 animate-pulse">
                <div className="h-8 w-48 bg-gray-800 rounded mb-8"></div>
                <div className="grid grid-cols-3 gap-6">
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

    const { totalCost, totalGenerations, modelBreakdown } = data;
    const costPerImage = totalGenerations > 0 ? (totalCost / totalGenerations).toFixed(4) : '0.0000';

    // Gemini 3 Stats
    const geminiStats = modelBreakdown['gemini-3.0-pro-image-preview'] || { count: 0, cost: 0, inputTokens: 0, outputTokens: 0 };

    return (
        <div className="min-h-screen bg-black text-white p-8 font-sans">
            <header className="mb-8 flex items-center justify-between">
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
                <button
                    onClick={loadData}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                >
                    <RefreshCw size={20} />
                </button>
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
                    <div className="text-xs text-gray-500 mt-2">All time</div>
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
                        {(geminiStats.inputTokens / 1000000).toFixed(1)}M <span className="text-gray-600 text-sm">In</span>
                    </div>
                    <div className="text-2xl font-bold font-mono">
                        {(geminiStats.outputTokens / 1000000).toFixed(1)}M <span className="text-gray-600 text-sm">Out</span>
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
                            {Object.entries(modelBreakdown).map(([id, stats]: [string, any]) => (
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

            <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-200 text-sm">
                <strong>Pricing Note:</strong> Costs are estimated based on Gemini 3.0 Pro preview rates ($3.50/1M In, $10.50/1M Out). Actual billing from Google Cloud may vary.
            </div>
        </div>
    );
}
