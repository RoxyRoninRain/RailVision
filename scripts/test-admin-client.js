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
    console.error('Missing Credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function testAdminFetch() {
    const orgId = 'cbc0da2d-7db3-4d42-93e8-404d38912364';
    console.log("Testing Admin Fetch for Org:", orgId);

    const { data, error } = await supabase
        .from('profiles')
        .select('email, shop_name')
        .eq('id', orgId)
        .single();

    if (error) {
        console.error("Fetch Failed:", error);
    } else {
        console.log("Fetch Success:", data);
    }
}

testAdminFetch();
