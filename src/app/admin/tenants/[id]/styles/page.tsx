
import { getTenantStyles } from '@/app/actions/portfolio';
import StylesManager from '@/app/dashboard/styles/StylesManager';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function AdminTenantStylesPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { data: styles, error } = await getTenantStyles(id);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div>
                <Link href={`/admin/tenants/${id}`} className="flex items-center gap-2 text-gray-500 hover:text-white mb-4 transition-colors">
                    <ArrowLeft size={16} /> Back to Tenant Details
                </Link>
                <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Manage Tenant Styles</h1>
                <p className="text-gray-500">
                    You are viewing and editing styles as an Admin for Tenant ID: <span className="font-mono text-xs bg-zinc-900 px-2 py-1 rounded">{id}</span>
                </p>
            </div>

            <StylesManager
                initialStyles={styles || []}
                serverError={error}
                isAdmin={true}
                adminTenantId={id}
            />
        </div>
    );
}
