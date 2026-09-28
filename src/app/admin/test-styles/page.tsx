import { getAdminStats } from '@/app/actions/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminTestStylesHubPage() {
    const tenants = await getAdminStats();

    if (tenants && tenants.length > 0) {
        // Automatically route to first tenant's testing studio
        redirect(`/admin/tenants/${tenants[0].organization_id}/test`);
    }

    return (
        <div className="max-w-4xl mx-auto py-12 px-6">
            <div className="bg-[#111] border border-white/10 rounded-2xl p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                    <Sparkles size={24} />
                </div>
                <h1 className="text-2xl font-bold text-white">Tenant Style Testing Sandbox</h1>
                <p className="text-gray-400 text-sm max-w-md mx-auto">
                    No active tenants found. Onboard or create a tenant first to test their visualizer styles with zero usage charges.
                </p>
                <Link
                    href="/admin/tenants"
                    className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded text-xs font-bold uppercase tracking-wider font-mono transition-colors"
                >
                    <Users size={14} /> Go to Tenants Directory
                </Link>
            </div>
        </div>
    );
}
