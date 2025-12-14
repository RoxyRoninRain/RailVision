import { getTenantStyles, getProfile, PortfolioItem } from '@/app/actions';
import StylesManager from './StylesManager';

export default async function Page() {
    const stylesResult = await getTenantStyles();
    const profile = await getProfile();
    const initialStyles = stylesResult.data || [];
    const serverError = stylesResult.error;

    return <StylesManager initialStyles={initialStyles} serverError={serverError} logoUrl={profile?.logo_url} />;
}
