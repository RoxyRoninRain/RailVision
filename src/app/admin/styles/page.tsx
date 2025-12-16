import { getTenantStyles, getProfile } from '@/app/actions';
import StylesManager from '@/app/dashboard/styles/StylesManager';

export const dynamic = 'force-dynamic';

export default async function AdminStylesPage() {
    // This fetches styles for the CURRENTLY LOGGED IN ADMIN
    // Effectively managing the "Railify" default tenant styles
    const stylesResult = await getTenantStyles();
    const profile = await getProfile();

    // We can assume the admin doesn't need a logoUrl override for now, or use the one from their profile if set
    const initialStyles = stylesResult.data || [];
    const serverError = stylesResult.error;

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-black uppercase text-white">Global Style Library</h1>
                <p className="text-gray-500 font-mono text-sm mt-1">Manage the default styles shown on the Railify Landing Page Demo.</p>
            </div>

            <StylesManager
                initialStyles={initialStyles}
                serverError={serverError}
                logoUrl={profile?.logo_url || '/logo.png'}
            />
        </div>
    );
}
