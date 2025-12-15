
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manual env loader
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (!fs.existsSync(envPath)) return;
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach((line) => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) return;
            const eqIdx = trimmedLine.indexOf('=');
            if (eqIdx > 0) {
                const key = trimmedLine.substring(0, eqIdx).trim();
                let value = trimmedLine.substring(eqIdx + 1).trim();
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                process.env[key] = value;
            }
        });
        console.log("Loaded keys:", Object.keys(process.env).filter(k => k.startsWith('SUPABASE') || k.startsWith('NEXT')));
    } catch (e) {
        console.error("Error loading env:", e);
    }
}

async function run() {
    loadEnv();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Use Service Key if available, otherwise Anon
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.argv[2];
    const clientKey = serviceKey || anonKey;

    if (!supabaseUrl || !clientKey) {
        console.error("Missing Supabase URL or Key");
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, clientKey);

    console.log("Searching for 'Mississippi Metal Magic'...");

    // 1. Find the tenant
    const { data: profiles, error: searchError } = await supabase
        .from('profiles')
        .select('id, shop_name, tier, credits_monthly')
        .ilike('shop_name', '%Mississippi Metal Magic%');

    if (searchError) {
        console.error("Search failed:", searchError);
        return;
    }

    if (!profiles || profiles.length === 0) {
        console.error("No tenant found matching 'Mississippi Metal Magic'. Checking ALL tenants...");
        const { data: all } = await supabase.from('profiles').select('shop_name, id').limit(10);
        console.log("Available tenants:");
        all.forEach(p => console.log(`- ${p.shop_name} (${p.id})`));
        return;
    }

    const target = profiles[0];
    console.log(`Found tenant: ${target.shop_name} (${target.id})`);

    // 2. Update or Generate SQL
    if (serviceKey) {
        console.log("Service Key found. Attempting direct update...");
        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                tier: 'showroom',
                credits_monthly: 500,
                credits_rollover: 0,
                credits_booster: 0,
                auto_boost_enabled: false
            })
            .eq('id', target.id);

        if (updateError) console.error("Update failed:", updateError);
        else console.log("✅ Update SUCCESS!");
    } else {
        console.log("\n⚠️  No Service Role Key found. Cannot update directly.");
        console.log("Please run this SQL in your Supabase SQL Editor:");
        console.log("\n---------------------------------------------------");
        console.log(`UPDATE profiles 
SET tier = 'showroom', 
    credits_monthly = 500, 
    credits_rollover = 0, 
    credits_booster = 0 
WHERE id = '${target.id}';`);
        console.log("---------------------------------------------------\n");
    }
}

run();
