import DesignStudio from './DesignStudio';
import { getStyles, getPublicStyles, getTenantLogo } from './actions';

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
