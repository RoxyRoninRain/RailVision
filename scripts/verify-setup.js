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
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verify() {
    console.log("=== Verifying Setup ===");

    // 1. Check 'leads' table schema
    console.log("\n1. Checking 'leads' table schema...");
    const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('id, attachments') // Try to select the new column
        .limit(1);

    if (leadsError) {
        if (leadsError.message.includes('does not exist')) {
            console.error("❌ FAILURE: 'attachments' column missing in 'leads' table.");
            console.error("   Action: Run the SQL migration or checking spelling.");
        } else {
            console.error("❌ FAILURE: Could not query 'leads' table:", leadsError.message);
        }
    } else {
        console.log("✅ SUCCESS: 'attachments' column exists in 'leads'.");
    }

    // 2. Check 'profiles' table schema
    console.log("\n2. Checking 'profiles' table schema...");
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('confirmation_email_body') // Try to select the new column
        .limit(1);

    if (profilesError) {
        if (profilesError.message.includes('does not exist')) {
            console.error("❌ FAILURE: 'confirmation_email_body' column missing in 'profiles' table.");
        } else {
            console.error("❌ FAILURE: Could not query 'profiles' table:", profilesError.message);
        }
    } else {
        console.log("✅ SUCCESS: 'confirmation_email_body' column exists in 'profiles'.");
    }

    // 3. Check Storage Bucket
    console.log("\n3. Checking 'quote-uploads' bucket...");
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
        console.error("❌ FAILURE: Could not list buckets:", bucketsError.message);
    } else {
        const quoteBucket = buckets.find(b => b.name === 'quote-uploads');
        if (!quoteBucket) {
            console.error("❌ FAILURE: 'quote-uploads' bucket NOT found.");
            console.error("   Action: Create a new PUBLIC bucket named 'quote-uploads'.");
        } else {
            console.log("✅ SUCCESS: 'quote-uploads' bucket found.");
            if (quoteBucket.public) {
                console.log("✅ SUCCESS: Bucket is Public.");
            } else {
                console.error("❌ WARNING: Bucket found but might NOT be Public (check dashboard).");
            }
        }
    }
}

verify();
