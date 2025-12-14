import DesignStudio from './DesignStudio';
import { getStyles, getPublicStyles, getTenantLogo } from './actions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  // Await searchParams in Next.js 15+
  const { org } = await searchParams;
  let orgId = org || '';

  // 1. If no Org ID in params, try to infer from session (Logged in Owner View)
  if (!orgId) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      orgId = user.id;
    }
  }

  // Fetch synced styles
  // If orgId is still empty here, it means Public Visitor with no specific link -> Generic
  const styles = await getPublicStyles(orgId);

  // Fetch Tenant Profile
  let tenantProfile = null;
  if (orgId) {
    const { getTenantProfile } = await import('./actions');
    tenantProfile = await getTenantProfile(orgId);
  } else {
    // Fallback logic for generic visitor
    const { getTenantLogo } = await import('./actions');
    const logo = await getTenantLogo();
    if (logo) {
      tenantProfile = {
        logo_url: logo,
        shop_name: null,
        phone: null,
        address: null,
        primary_color: null
      };
    }
  }

  // Fallback styles: ONLY if we are in "Generic Mode" (!orgId) and have no styles.
  // If we have an orgId (Tenant Mode), we respect their DB state (even if empty).
  // This allows tenants to "hide all" if they really want to (though UI might need to handle it).
  const defaultStyles = [
    { id: '1', name: 'Industrial Modern', description: 'Clean lines with raw metal finishes', image_url: '/styles/industrial.png' },
    { id: '2', name: 'Classic Wrought Iron', description: 'Timeless elegance with ornate details', image_url: '/styles/classic.png' },
    { id: '3', name: 'Minimalist Glass', description: 'Sleek and transparent for open spaces', image_url: '/styles/minimalist.png' },
    { id: '4', name: 'Rustic Farmhouse', description: 'Warm wood tones mixed with metal', image_url: '/styles/rustic.png' },
    { id: '5', name: 'Art Deco', description: 'Bold geometric patterns and luxury', image_url: '/styles/artdeco.png' },
  ];

  const safeStyles = (styles.length > 0 || orgId) ? styles : defaultStyles; // If orgId exists but styles=[], we pass [], allowing DesignStudio to handle "No Styles" instead of forcing defaults.

  // Wait, if safeStyles is [] DesignStudio crashes. 
  // If orgId exists and styles is empty, we must ensure DesignStudio can handle it.
  // If user deleted all styles, we typically want to show "No active styles".
  // Let's pass 'defaults' if styles is truly empty? 
  // No, user specifically said "users can delete or hid them".
  // If I force defaults back, they can't.
  // So I must allow empty array.

  return <DesignStudio styles={safeStyles} tenantProfile={tenantProfile} orgId={orgId} />;
}
