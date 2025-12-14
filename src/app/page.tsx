import DesignStudio from './DesignStudio';
import { getStyles, getPublicStyles, getTenantLogo } from './actions';

export const dynamic = 'force-dynamic';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  // Await searchParams in Next.js 15+
  const { org } = await searchParams;
  const orgId = org || '';

  // Fetch synced styles
  const styles = await getPublicStyles(orgId);

  // Fetch Tenant Profile
  let tenantProfile = null;
  if (orgId) {
    const { getTenantProfile } = await import('./actions');
    tenantProfile = await getTenantProfile(orgId);
  } else {
    // Fallback: Check if we are running on a subdomain or similar? 
    // For now, just explicit param.
    const { getTenantLogo } = await import('./actions');
    const logo = await getTenantLogo(); // old fallback
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

  // Fallback styles (Matches 'seedDefaults' in actions.ts)
  const safeStyles = styles.length > 0 ? styles : [
    { id: '1', name: 'Industrial Modern', description: 'Clean lines with raw metal finishes', image_url: '/styles/industrial.png' },
    { id: '2', name: 'Classic Wrought Iron', description: 'Timeless elegance with ornate details', image_url: '/styles/classic.png' },
    { id: '3', name: 'Minimalist Glass', description: 'Sleek and transparent for open spaces', image_url: '/styles/minimalist.png' },
    { id: '4', name: 'Rustic Farmhouse', description: 'Warm wood tones mixed with metal', image_url: '/styles/rustic.png' },
    { id: '5', name: 'Art Deco', description: 'Bold geometric patterns and luxury', image_url: '/styles/artdeco.png' },
  ];

  return <DesignStudio styles={safeStyles} tenantProfile={tenantProfile} orgId={orgId} />;
}
