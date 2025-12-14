'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getTenantDetails, updateSubscriptionStatus } from '@/app/admin/actions';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Shield, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function TenantShadowPage() {
    const params = useParams();
    const id = params?.id as string;

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        getTenantDetails(id).then(res => {
            setData(res);
            setLoading(false);
        });
    }, [id]);

    if (loading) return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
            <div className="text-red-500 font-mono animate-pulse tracking-widest">ESTABLISHING SHADOW LINK...</div>
        </div>
    );

    if (!data || !data.profile) return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-gray-500">
            <h1 className="text-2xl font-mono text-white mb-4">TARGET NOT FOUND</h1>
            <Link href="/admin/tenants" className="text-red-500 hover:underline">Return to Command Center</Link>
        </div>
    );

    const { profile, leads } = data;

    const handleSubscription = async (newStatus: 'active' | 'cancelled') => {
        if (!confirm(`Are you sure you want to set subscription to: ${newStatus.toUpperCase()}?`)) return;

        const res = await updateSubscriptionStatus(id, newStatus);
        if (res.success) {
            setData((prev: any) => ({
                ...prev,
                profile: { ...prev.profile, subscription_status: newStatus }
            }));
        } else {
            alert('Failed to update subscription: ' + res.error);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-red-500/30">
            {/* ALERT BANNER */}
            <div className="bg-red-900/20 border-b border-red-900/40 text-red-500 px-4 py-2 text-center text-xs font-mono font-bold tracking-widest uppercase flex items-center justify-center gap-2">
                <Shield size={14} />
                Restricted Access: Shadow View Mode
            </div>

            <header className="border-b border-white/10 bg-[#0a0a0a]">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/admin/tenants" className="text-gray-400 hover:text-white flex items-center gap-2 text-sm font-mono transition-colors">
                        <ArrowLeft size={16} /> BACK TO DIRECTORY
                    </Link>
                    <div className="font-mono text-xs text-gray-600">ID: {id}</div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LEFT COL: PROFILE */}
                <div className="space-y-6">
                    <div className="bg-[#111] border border-white/10 rounded-lg p-6">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center text-2xl font-bold text-red-500">
                                {profile.shop_name ? profile.shop_name.substring(0, 1) : '?'}
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white leading-tight">{profile.shop_name || 'Unnamed Shop'}</h1>
                                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] uppercase font-mono border ${profile.subscription_status === 'active' ? 'bg-green-900/20 text-green-400 border-green-900/30' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                                    {profile.subscription_status || 'Unknown'} Status
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-sm text-gray-400">
                                <Mail size={16} className="text-gray-600" />
                                <span>{profile.email}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-400">
                                <Phone size={16} className="text-gray-600" />
                                <span>{profile.phone || 'No phone listed'}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-400">
                                <MapPin size={16} className="text-gray-600" />
                                <span>{profile.address || 'No address listed'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#111] border border-white/10 rounded-lg p-6">
                        <h3 className="text-sm font-mono text-gray-500 uppercase tracking-widest mb-4">Subscription Management</h3>

                        <div className="space-y-3">
                            {profile.subscription_status === 'active' ? (
                                <button
                                    onClick={() => handleSubscription('cancelled')}
                                    className="block w-full text-center bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-500 rounded py-3 text-xs font-bold uppercase tracking-wider transition-colors"
                                >
                                    Cancel Subscription
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleSubscription('active')}
                                    className="block w-full text-center bg-green-900/20 hover:bg-green-900/40 border border-green-900/50 text-green-500 rounded py-3 text-xs font-bold uppercase tracking-wider transition-colors"
                                >
                                    Reactivate Subscription
                                </button>
                            )}

                            <a
                                href={`mailto:${profile.email}`}
                                className="block w-full text-center bg-white/5 hover:bg-white/10 border border-white/10 rounded py-2 text-xs text-gray-400 font-mono transition-colors"
                            >
                                Contact Owner
                            </a>
                        </div>
                    </div>
                </div>

                {/* RIGHT COL: LEADS */}
                <div className="lg:col-span-2">
                    <div className="bg-[#0a0a0a] border border-white/5 rounded-lg overflow-hidden">
                        <div className="p-4 border-b border-white/5 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-white">Recent Leads</h2>
                            <span className="text-xs font-mono text-gray-500">LAST 50 RECORDS</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[#111] text-gray-500 font-mono text-xs uppercase">
                                    <tr>
                                        <th className="p-4 font-normal">Customer</th>
                                        <th className="p-4 font-normal">Style</th>
                                        <th className="p-4 font-normal">Status</th>
                                        <th className="p-4 font-normal text-right">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {leads && leads.map((lead: any) => (
                                        <tr key={lead.id} className="hover:bg-white/[0.02]">
                                            <td className="p-4">
                                                <div className="font-medium text-white">{lead.customer_name}</div>
                                                <div className="text-xs text-gray-500">{lead.email}</div>
                                            </td>
                                            <td className="p-4 text-gray-400">{lead.style_name || '-'}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded textxs capitalize ${lead.status === 'New' ? 'bg-blue-900/20 text-blue-400' :
                                                    lead.status === 'Closed' ? 'bg-green-900/20 text-green-400' :
                                                        'bg-gray-800 text-gray-400'
                                                    }`}>
                                                    {lead.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right text-gray-500 font-mono text-xs">
                                                {new Date(lead.created_at).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                    {(!leads || leads.length === 0) && (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-gray-600 italic">No leads found for this tenant.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
