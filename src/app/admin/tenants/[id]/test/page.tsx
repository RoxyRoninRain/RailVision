import { getTenantDetails } from '@/app/admin/actions';
import { getTenantStyles } from '@/app/actions/portfolio';
import { getAdminStats } from '@/app/actions/admin';
import TenantStyleTester from './TenantStyleTester';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminTenantTestPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const [tenantData, stylesRes, allTenants] = await Promise.all([
        getTenantDetails(id),
        getTenantStyles(id),
        getAdminStats(),
    ]);

    if (!tenantData || !tenantData.profile) {
        return notFound();
    }

    return (
        <TenantStyleTester
            tenantId={id}
            profile={tenantData.profile}
            initialStyles={stylesRes.data || []}
            allTenants={allTenants || []}
        />
    );
}
