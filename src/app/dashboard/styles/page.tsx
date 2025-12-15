import { getTenantStyles, getProfile, PortfolioItem } from '@/app/actions';
import StylesManager from './StylesManager';

export default async function Page() {
    const stylesResult = await getTenantStyles();
    const profile = await getProfile();
    const initialStyles = stylesResult.data || [];
    const serverError = stylesResult.error;

    return (
        <div className="p-8">
            <h1 className="text-3xl font-black uppercase mb-8 text-white">Style Library</h1>
            <StylesManager
                initialStyles={initialStyles || []}
                logoUrl={profile?.watermark_logo_url || profile?.logo_url || undefined}
                tier={profile?.tier || 'salesmate'}
            />
        </div>
    );
}
