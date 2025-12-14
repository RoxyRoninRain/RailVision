import DesignStudio from './DesignStudio';
import { getStyles, getTenantLogo } from './actions';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  // Await searchParams in Next.js 15+
  const { org } = await searchParams;
  const orgId = org || '';

  const styles = await getStyles(orgId);

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
        // Ensure all required fields of Profile or partial structure are met?
        // Actually Profile interface has 'shop_name: string | null'.
        // This object { logo_url, shop_name: null, ... } matches expected.
      };
    }
  }

  // Fallback styles
  const safeStyles = styles.length > 0 ? styles : [
    { id: '1', name: 'Industrial', description: 'Raw steel and exposed elements' },
    { id: '2', name: 'Modern Minimalist', description: 'Clean lines and glass' },
    { id: '3', name: 'Rustic', description: 'Wood and iron' }
  ];

  return <DesignStudio styles={safeStyles} tenantProfile={tenantProfile} orgId={orgId} />;
}
