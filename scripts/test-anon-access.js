const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Helper to parse .env.local
function getEnv() {
    const envPath = path.join(__dirname, '..', '.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            env[match[1]] = match[2].trim();
        }
    });
    return env;
}

const env = getEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Env Vars');
    process.exit(1);
}

async function checkAnonAccess() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    console.log('Attempting fetch with ANON KEY...');

    const { data, error } = await supabase
        .from('system_prompts')
        .select('*')
        .eq('is_active', true)
        //.order('created_at', { ascending: false }) // Column might not exist depending on schema drift
        .limit(1)
        .single();

    if (error) {
        console.error('ANON FETCH ERROR:', error);
    } else {
        console.log('ANON FETCH SUCCESS:', data);
    }
}

checkAnonAccess();
