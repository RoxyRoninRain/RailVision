
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Try to load env vars from .env.local
try {
    const envConfig = require('dotenv').config({ path: '.env.local' });
} catch (e) {
    console.log("Could not load .env.local via dotenv (optional in some setups).");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkBuckets() {
    console.log("Checking Storage Buckets...");

    const buckets = ['logos', 'admin-assets']; // Check 'admin-assets' too based on user comment

    for (const bucket of buckets) {
        console.log(`\n--- Bucket: ${bucket} ---`);

        const { data: files, error } = await supabase.storage.from(bucket).list('', { limit: 100 });

        if (error) {
            console.error(`Error listing ${bucket}:`, error.message);
        } else {
            console.log(`File Count: ${files ? files.length : 0}`);
            if (files && files.length > 0) {
                console.log("First 5 files:");
                files.slice(0, 5).forEach(f => console.log(` - ${f.name} (${(f.metadata.size / 1024).toFixed(2)} KB)`));
            } else {
                console.log("Bucket is empty or folder-based structure prevents root listing.");
                // Try deep list if empty? Usually recursive isn't default.
            }
        }
    }
}

checkBuckets();
