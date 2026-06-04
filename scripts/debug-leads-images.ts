import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env vars manually
const envPath = path.join(process.cwd(), '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentLeads() {
    const { data: leads, error } = await supabase
        .from('leads')
        .select('id, created_at, generated_design_url, organization_id')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching leads:', error);
        return;
    }

    console.log('Recent Leads Image URLs:');
    leads.forEach(lead => {
        console.log(`[${lead.created_at}] ID: ${lead.id} | Org: ${lead.organization_id}`);
        console.log(`URL: ${lead.generated_design_url}`);
        console.log('---');
    });
}

checkRecentLeads();
