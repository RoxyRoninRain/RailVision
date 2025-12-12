'use client';

import { useEffect, useState } from 'react';
import { getAdminStats } from '@/app/actions';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminStatsPage() {
    const [data, setData] = useState<{ organization_id: string, count: number }[]>([]);

    useEffect(() => {
        getAdminStats().then(setData);
    }, []);

    // Mock enhancement: convert organization_id to names if possible or just show ID
    const chartData = data.map(item => ({
        ...item,
        name: item.organization_id.substring(0, 8) + '...'
    }));

    return (
        <div>
            <h1 className="text-3xl font-mono text-[var(--primary)] mb-8">Global Metrics</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-[#111] p-6 rounded border border-gray-800">
                    <h2 className="text-xl mb-4 text-gray-400">Total Leads per Shop</h2>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis dataKey="name" stroke="#666" />
                                <YAxis stroke="#666" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }}
                                />
                                <Bar dataKey="count" fill="var(--primary)" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-[#111] p-6 rounded border border-gray-800">
                    <h2 className="text-xl mb-4 text-gray-400">Total Revenue (Estimated)</h2>
                    <p className="text-4xl font-mono font-bold text-green-500">
                        ${data.reduce((acc, curr) => acc + (curr.count * 2000), 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">Based on avg $2k/deal</p>
                </div>
            </div>
        </div>
    );
}
