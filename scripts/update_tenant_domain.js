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

        const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

        // Find Mississippi Metal Magic
        const { data: users, error: userError } = await supabase.auth.admin.listUsers();
        if (userError) throw userError;

        const tenant = users.users.find(u => u.email.includes('mississippi') || u.email.includes('mmm'));
        if (tenant) {
            console.log(`Found tenant ${tenant.email} (${tenant.id})`);

            // Update profile
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ website: 'https://mississippimetalmagic.com' })
                .eq('id', tenant.id);

            if (updateError) console.error("Update failed (column likely missing):", updateError.message);
            else console.log("Updated website for tenant!");

        } else {
            console.log("Tenant not found.");
        }
    } catch (e) {
        console.error(e);
    }
}
main();
