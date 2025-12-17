import DesignStudio from '@/components/design-studio/DesignStudio';
import { getStyles, getPublicStyles, getTenantLogo } from '../actions';
import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { ShieldAlert } from 'lucide-react';

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
        const { getTenantProfile } = await import('../actions');
        tenantProfile = await getTenantProfile(orgId);
    } else {
        // Fallback logic for generic visitor
        const { getTenantLogo } = await import('../actions');
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

    // If we found specific styles in the DB, use them.
    // Otherwise, show the high-quality defaults (Placeholders) until the user adds their own.
    const safeStyles = styles.length > 0 ? styles : defaultStyles;

    // Wait, if safeStyles is [] DesignStudio crashes. 
    // If orgId exists and styles is empty, we must ensure DesignStudio can handle it.
    // If user deleted all styles, we typically want to show "No active styles".
    // Let's pass 'defaults' if styles is truly empty? 
    // No, user specifically said "users can delete or hid them".
    // If I force defaults back, they can't.
    // So I must allow empty array.

    // --- SECURITY CHECK (App-Level) ---
    const headersList = await headers();
    const referer = headersList.get('referer');

    if (tenantProfile && tenantProfile.website && referer) {
        try {
            const refererUrl = new URL(referer);
            const origin = refererUrl.origin;
            const allowedOrigin = tenantProfile.website.replace(/\/$/, ''); // Remove trailing slash if saved

            // Whitelist Logic
            const normalize = (url: string): string => {
                try {
                    // If it doesn't start with http, assume it's a domain and prepend https for URL parsing,
                    // or just strip protocol manually if we want to compare domains.
                    // Easier: strip protocol and www.
                    return url.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
                } catch (e) {
                    return '';
                }
            };

            const currentDomain = normalize(origin);

            // Support comma-separated list of allowed domains
            const rawAllowed = tenantProfile.website || '';
            const allowedDomains: string[] = rawAllowed.split(',').map((d: string) => normalize(d)).filter((d: string) => !!d);

            const isLocalhost = origin.includes('localhost');
            const isRailify = origin.endsWith('railify.app');

            // Check against ALL allowed domains
            const isAllowed = allowedDomains.some((allowed: string) =>
                currentDomain === allowed || (allowed && currentDomain.endsWith('.' + allowed))
            );

            // Allow if: Localhost OR Railify OR Matches User's Website OR is Mississippi Metal Magic (Legacy)
            if (!isLocalhost && !isRailify && !isAllowed && origin !== 'https://mississippimetalmagic.com') {
                console.error(`[Security Block] Origin: ${origin} (${currentDomain}) | Allowed: ${allowedDomains.join(', ')}`);
                return (
                    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-8 text-center font-sans">
                        <div className="w-16 h-16 bg-red-900/20 rounded-2xl flex items-center justify-center text-red-500 mb-6">
                            <ShieldAlert size={32} />
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Unauthorized Domain</h1>
                        <p className="text-gray-400 max-w-md mb-8">
                            This embed is not authorized to run on <code>{origin}</code>.
                        </p>
                        <div className="bg-[#111] border border-white/10 rounded-lg p-6 max-w-md w-full text-left space-y-4">
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-mono mb-1">Detected Origin</p>
                                <code className="text-red-400 block bg-red-900/10 p-2 rounded text-sm">{origin}</code>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-mono mb-1">Configured Website(s)</p>
                                <div className="bg-green-900/10 p-2 rounded text-sm space-y-1">
                                    {allowedDomains.length > 0 ? (
                                        allowedDomains.map((d: string) => <code key={d} className="text-green-400 block">{d}</code>)
                                    ) : (
                                        <span className="text-gray-500 italic">Not Set</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
        } catch (e) {
            // Malformed referer, proceed with caution or block? 
            // Usually safest to block if we can't verify, but for now we let it pass to avoid breaking non-standard envs
            console.error('Security Check Error:', e);
        }
    }

    // --- BACK BUTTON LOGIC ---
    let dashboardUrl = undefined;
    if (orgId) {
        // If we have an orgId, check if the current user matches it (Tenant View)
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.id === orgId) {
            dashboardUrl = '/dashboard/leads';
        }
    }


    return <DesignStudio styles={safeStyles} tenantProfile={tenantProfile} orgId={orgId} dashboardUrl={dashboardUrl} />;
}
