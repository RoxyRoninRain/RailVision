
import { getActingUser } from '@/lib/auth-context';
import DashboardLayoutClient from './DashboardLayoutClient';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { isImpersonating, tenantId, user, supabase } = await getActingUser();

    // Prefetch shop name for the acting user (Tenant or Impersonated Tenant)
    let shopName = '';
    if (user) {
        // Use the 'supabase' client from context (which is Admin if impersonating, or Regular)
        // Note: if impersonating, 'user' is still the Admin User object from Auth, 
        // but we want the PROFILE of the 'tenantId'

        // Wait, if isImpersonating, 'user' from getActingUser is the ADMIN User.
        // But we want to display the SHOP NAME of the TENANT we are impersonating.

        const targetId = tenantId; // This is the tenant ID we are acting as

        const { data: profile } = await supabase
            .from('profiles')
            .select('shop_name')
            .eq('id', targetId)
            .single();

        if (profile?.shop_name) {
            shopName = profile.shop_name;
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
