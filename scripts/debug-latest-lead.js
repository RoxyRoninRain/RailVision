const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = {};
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            envConfig[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
        }
    });
}

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkLatestLead() {
    console.log("=== Checking Latest Lead ===");

    const { data, error } = await supabase
        .from('leads')
        .select('id, created_at, customer_name, email, attachments, style_name')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        console.error("Error fetching lead:", error);
    } else {
        console.log("Latest Lead:");
        console.log(`- ID: ${data.id}`);
        console.log(`- Name: ${data.customer_name}`);
        console.log(`- Time: ${new Date(data.created_at).toLocaleString()}`);
        console.log(`- Style: ${data.style_name}`);
        console.log(`- Attachments (${data.attachments ? data.attachments.length : 0}):`);
        console.dir(data.attachments);
    }
}

checkLatestLead();
