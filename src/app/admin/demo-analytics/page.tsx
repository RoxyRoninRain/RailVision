import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getBlockedIps, blockIp, unblockIp } from '@/app/admin/actions/security';
import { Activity, Shield, DollarSign, Image as ImageIcon, Search, AlertCircle, Ban, CheckCircle, RefreshCcw } from 'lucide-react';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export default async function DemoAnalyticsPage() {
    const supabase = createAdminClient();
    if (!supabase) return <div className="text-red-500 p-8">Admin Client Error</div>;

    const DEMO_ORG_ID = 'd899bbe8-10b5-4ee7-8ee5-5569e415178f';

    // 1. Fetch Demo Stats (Total)
    // We count generations for this specific organization
    const { count: totalDemos } = await supabase
        .from('generations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', DEMO_ORG_ID);

    // 2. Fetch Recent Usage (Last 50)
    const { data: recentUsage } = await supabase
        .from('generations')
        .select('*')
        .eq('organization_id', DEMO_ORG_ID)
        .order('created_at', { ascending: false })
        .limit(50);

    // 3. Fetch Blocked IPs
    const blockedIps = await getBlockedIps();

    // 4. Calculate Approximate Spend
    // gemini-3.0-pro-image-preview: ~$0.04/img (Input+Output+Gen)
    // This is a rough estimate based on observed average
    const estimatedCost = (totalDemos || 0) * 0.04;

    // 5. Unique IPs in recent usage (Active Users)
    const uniqueActiveIps = new Set(recentUsage?.map(g => g.ip_address).filter(Boolean)).size;

    // --- ACTIONS ---
    async function handleBlock(formData: FormData) {
        'use server';
        const ip = formData.get('ip') as string;
        await blockIp(ip, 'Manual Block via Admin');
    }

    async function handleUnblock(formData: FormData) {
        'use server';
        const ip = formData.get('ip') as string;
        await unblockIp(ip);
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-red-500/30">
            {/* TOP BAR */}
            <header className="border-b border-white/10 bg-[#0a0a0a] mb-8">
                <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.5)]"></div>
                        <h1 className="text-xl font-mono font-bold tracking-tight text-white uppercase">
                            Demo Usage <span className="text-gray-600">& Security</span>
                        </h1>
                    </div>
                    <div className="pl-6 text-xs font-mono text-gray-500 flex gap-4">
                        <span>TARGET: LANDING PAGE</span>
                        <span>ORG: {DEMO_ORG_ID.substring(0, 8)}...</span>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 pb-12 space-y-8">

                {/* 1. STATS CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-[#111] border border-white/10 p-6 rounded-lg relative overflow-hidden">
                        <Activity className="text-blue-500 mb-2" size={24} />
                        <p className="text-gray-500 text-xs font-mono uppercase tracking-widest">Total Demos</p>
                        <p className="text-3xl font-bold">{totalDemos || 0}</p>
                    </div>
                    <div className="bg-[#111] border border-white/10 p-6 rounded-lg relative overflow-hidden">
                        <DollarSign className="text-green-500 mb-2" size={24} />
                        <p className="text-gray-500 text-xs font-mono uppercase tracking-widest">Est. Cost</p>
                        <p className="text-3xl font-bold">${estimatedCost.toFixed(2)}</p>
                        <p className="text-[10px] text-gray-600 font-mono mt-1">~$0.04 / gen</p>
                    </div>
                    <div className="bg-[#111] border border-white/10 p-6 rounded-lg relative overflow-hidden">
                        <Shield className="text-red-500 mb-2" size={24} />
                        <p className="text-gray-500 text-xs font-mono uppercase tracking-widest">Blocked IPs</p>
                        <p className="text-3xl font-bold">{blockedIps.length}</p>
                    </div>
                    <div className="bg-[#111] border border-white/10 p-6 rounded-lg relative overflow-hidden">
                        <Search className="text-purple-500 mb-2" size={24} />
                        <p className="text-gray-500 text-xs font-mono uppercase tracking-widest">Unique Active IPs</p>
                        <p className="text-3xl font-bold">{uniqueActiveIps}</p>
                        <p className="text-[10px] text-gray-600 font-mono mt-1">Last 50 Runs</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* 2. RECENT TRAFFIC LOG */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="font-mono font-bold text-lg flex items-center gap-2">
                                <Activity size={18} className="text-gray-500" /> RECENT TRAFFIC
                            </h2>
                            <span className="text-xs font-mono text-gray-600">LAST 50 REQUESTS</span>
                        </div>

                        <div className="bg-[#0a0a0a] border border-white/10 rounded-lg overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[#111] text-gray-500 font-mono text-xs uppercase border-b border-white/5">
                                    <tr>
                                        <th className="p-3 pl-4">Time</th>
                                        <th className="p-3">IP Address</th>
                                        <th className="p-3">Result</th>
                                        <th className="p-3 text-right pr-4">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 font-mono text-xs">
                                    {recentUsage?.map((gen) => {
                                        const isBlocked = blockedIps.some((b: any) => b.ip_address === gen.ip_address);
                                        return (
                                            <tr key={gen.id} className="hover:bg-white/[0.02]">
                                                <td className="p-3 pl-4 text-gray-400">
                                                    {new Date(gen.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    <div className="text-[10px] text-gray-600">
                                                        {new Date(gen.created_at).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-blue-400">
                                                    {gen.ip_address || 'Unknown'}
                                                    {isBlocked && (
                                                        <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-red-900/40 text-red-500 text-[9px] border border-red-900/50">
                                                            BLOCKED
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <a href={gen.image_url} target="_blank" className="text-gray-400 hover:text-white underline decoration-dotted">
                                                        View Image
                                                    </a>
                                                </td>
                                                <td className="p-3 text-right pr-4">
                                                    {!isBlocked && gen.ip_address && (
                                                        <form action={handleBlock}>
                                                            <input type="hidden" name="ip" value={gen.ip_address} />
                                                            <button className="text-red-500 hover:text-red-400 hover:underline">
                                                                BLOCK
                                                            </button>
                                                        </form>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {!recentUsage?.length && (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-gray-600 italic">No usage recorded yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 3. BLOCKED IPS MANAGER */}
                    <div className="space-y-4">
                        <h2 className="font-mono font-bold text-lg flex items-center gap-2">
                            <Shield size={18} className="text-gray-500" /> BLOCKED LIST
                        </h2>

                        <div className="bg-[#111] border border-red-900/20 rounded-lg p-4 space-y-3">
                            {blockedIps.map((entry: any) => (
                                <div key={entry.id} className="flex items-center justify-between p-3 bg-black border border-white/5 rounded group">
                                    <div>
                                        <p className="text-red-400 font-mono text-xs font-bold">{entry.ip_address}</p>
                                        <p className="text-[10px] text-gray-600">{new Date(entry.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <form action={handleUnblock}>
                                        <input type="hidden" name="ip" value={entry.ip_address} />
                                        <button className="p-1.5 text-gray-500 hover:text-green-500 hover:bg-green-900/10 rounded transition-colors" title="Unblock">
                                            <CheckCircle size={14} />
                                        </button>
                                    </form>
                                </div>
                            ))}
                            {!blockedIps.length && (
                                <div className="text-center py-8 text-gray-600 text-xs font-mono">
                                    <CheckCircle size={24} className="mx-auto mb-2 opacity-20" />
                                    SYSTEM SECURE<br />NO ACTIVE BLOCKS
                                </div>
                            )}
                        </div>

                        <div className="bg-blue-900/10 border border-blue-900/30 p-4 rounded text-xs text-blue-400">
                            <h3 className="font-bold flex items-center gap-2 mb-2">
                                <AlertCircle size={14} /> ABOUT IP BLOCKING
                            </h3>
                            <p className="opacity-80">
                                Blocking an IP prevents them from generating new designs on the landing page demo.
                                It does NOT prevent them from viewing the site.
                                Blocks are enforced via Server Check.
                            </p>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
