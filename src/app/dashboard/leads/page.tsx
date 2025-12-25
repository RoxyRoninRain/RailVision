import { getOwnerLeads } from '@/app/actions';
import LeadsDashboard from './LeadsDashboard';

export default async function Page() {
    const leads = await getOwnerLeads(10, 'Active');
    return <LeadsDashboard initialLeads={leads} />;
}
