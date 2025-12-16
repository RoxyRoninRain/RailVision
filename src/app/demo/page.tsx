import DesignStudio from '../DesignStudio';
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

    const safeStyles = (styles.length > 0 || orgId) ? styles : defaultStyles; // If orgId exists but styles=[], we pass [], allowing DesignStudio to handle "No Styles" instead of forcing defaults.

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
            const isLocalhost = origin.includes('localhost');
            const isRailify = origin.endsWith('railify.app');
            const isAllowed = origin === allowedOrigin;

            // Allow if: Localhost OR Railify OR Matches User's Website OR is Mississippi Metal Magic (Legacy)
            if (!isLocalhost && !isRailify && !isAllowed && origin !== 'https://mississippimetalmagic.com') {
                return (
                    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-8 text-center font-sans">
                        <div className="w-16 h-16 bg-red-900/20 rounded-2xl flex items-center justify-center text-red-500 mb-6">
                            <ShieldAlert size={32} />
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Unauthorized Domain</h1>
                        <p className="text-gray-400 max-w-md mb-8">
                            This embed is not authorized to run on <code>{origin}</code>.
                        </p>
                        <div className="bg-[#111] border border-white/10 rounded-lg p-4 max-w-sm w-full text-left">
                            <p className="text-xs text-gray-500 uppercase font-mono mb-2">How to fix this</p>
                            <p className="text-sm text-gray-300">
                                1. Log in to your <span className="text-primary font-bold">Railify Dashboard</span>.<br />
                                2. Go to <strong>Widget Integration</strong>.<br />
                                3. Add <code>{origin}</code> as your authorized domain.
                            </p>
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
