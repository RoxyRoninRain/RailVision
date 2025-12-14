import { getTenantStyles, PortfolioItem } from '@/app/actions';
import StylesManager from './StylesManager';

export default async function Page() {
    const styles = await getTenantStyles() as PortfolioItem[]; // Cast since we know the shape matches but Supabase returns any[] usually

    return <StylesManager initialStyles={styles || []} />;
}
