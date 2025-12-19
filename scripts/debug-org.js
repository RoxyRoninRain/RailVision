const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnv = (key) => {
    const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1].trim() : null;
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseServiceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase Credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugLeads() {
    console.log('\n--- Checking Last 5 Leads (Global) ---');
    const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (leadsError) {
        console.error('Leads Fetch Error:', leadsError);
    } else {
        console.log(`Found ${leads.length} recent leads:`);
        leads.forEach(l => {
            console.log(`- [${l.created_at}] Org: ${l.organization_id} | Name: ${l.customer_name}`);
            console.log(`  Style: ${l.style_name} | Phone: ${l.phone}`);
            console.log(`  Estimate JSON Type:`, typeof l.estimate_json);
            console.log(`  Estimate JSON Value:`, JSON.stringify(l.estimate_json, null, 2));
            console.log('------------------------------------------------');
        });
    }
}

debugLeads();
