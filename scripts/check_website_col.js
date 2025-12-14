const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        const envPath = path.join(__dirname, '..', '.env.local');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const env = {};
        envContent.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) env[match[1].trim()] = match[2].trim().replace(/"/g, '');
        });

        const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

        // Try to select 'website' column
        const { data, error } = await supabase.from('profiles').select('website').limit(1);

        if (error) {
            console.log("Error selecting query:", error.message);
            if (error.message.includes("does not exist")) {
                console.log("Column 'website' likely NOT present.");
            }
        } else {
            console.log("Column 'website' exists!");
        }

    } catch (e) {
        console.error(e);
    }
}
main();
