const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Manually Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
let env = {};
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^['"]|['"]$/g, '');
            env[key] = value;
        }
    });
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
// Prefer Service Key for full access, fallback to Anon
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing Supabase Credentials in .env.local');
    process.exit(1);
}

console.log(`Connecting to ${supabaseUrl}...`);

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
    console.log('Fetching all leads...');
    const { data: leads, error } = await supabase.from('leads').select('*');

    if (error) {
        console.error('Supabase Error:', error);
        return;
    }

    console.log(`Found ${leads.length} leads.`);
    let max = 0;
    let maxId = '';

    leads.forEach(lead => {
        const json = JSON.stringify(lead);
        const size = json.length;
        if (size > max) {
            max = size;
            maxId = lead.id;
        }

        if (size > 50000) { // > 50KB Warning
            console.log(`[WARNING] Lead ${lead.id} is ${size} bytes.`);
            if (lead.estimate_json && JSON.stringify(lead.estimate_json).length > 20000) {
                console.log(`   -> estimate_json is causing bloat.`);
            }
            if (lead.attachments && JSON.stringify(lead.attachments).length > 20000) {
                console.log(`   -> attachments is causing bloat.`);
            }
        }
    });

    console.log(`\nMax Lead Size: ${max} bytes (ID: ${maxId})`);

    // Check Portfolio too just in case
    const { data: styles } = await supabase.from('portfolio').select('*');
    if (styles) {
        styles.forEach(s => {
            const size = JSON.stringify(s).length;
            if (size > 50000) console.log(`[WARNING] Style ${s.id} is ${size} bytes.`);
        });
    }
}

runAudit();
