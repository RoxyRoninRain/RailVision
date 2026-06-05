
import { getActingUser } from '@/lib/auth-context';
import DashboardLayoutClient from './DashboardLayoutClient';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const context = await getActingUser();
    const { isImpersonating, tenantId, user, supabase, isAdmin } = context;

    // Prefetch shop name for the acting user (Tenant or Impersonated Tenant)
    let shopName = '';
    if (user) {
        const targetId = tenantId; // This is the tenant ID we are acting as

        const { data: profile } = await supabase
            .from('profiles')
            .select('shop_name, subscription_status, tier_name')
            .eq('id', targetId)
            .single();

        if (profile) {
            shopName = profile.shop_name || '';

            // Gate access if user is not an admin and subscription is not active
            if (!isAdmin && profile.subscription_status !== 'active') {
                redirect('/pricing');
            }
        }
    }

    return (
        <DashboardLayoutClient
            isImpersonating={!!isImpersonating}
            impersonatedTenantId={isImpersonating ? tenantId : undefined}
            currentUserEmail={user?.email}
            shopName={shopName}
        >
            {children}
        </DashboardLayoutClient>
    );
}
