const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function main() {
    try {
        // 1. Read env
        const envPath = path.join(__dirname, '..', '.env.local');
        if (!fs.existsSync(envPath)) {
            console.error("No .env.local found");
            process.exit(1);
        }

        const envContent = fs.readFileSync(envPath, 'utf8');
        const env = {};
        envContent.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                let value = match[2].trim();
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                env[match[1].trim()] = value;
            }
        });

        const url = env.NEXT_PUBLIC_SUPABASE_URL;
        // Try multiple keys
        const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const isServiceKey = !!env.SUPABASE_SERVICE_ROLE_KEY;

        if (!url || !key) {
            console.error("Missing credentials in .env.local. Found URL:", !!url, "Key:", !!key);
            process.exit(1);
        }

        console.log("Connecting to Supabase...");
        const supabase = createClient(url, key);

        // 2. Check for "Railify" profile
        console.log("Searching for 'Railify' profile...");
        const { data: existingProfiles, error: searchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('shop_name', 'Railify');

        if (searchError) {
            console.error("Error searching profiles:", searchError);
            // If table doesn't exist or RLS blocks it (and we only have anon key)
        }

        if (existingProfiles && existingProfiles.length > 0) {
            console.log(`FOUND_ID: ${existingProfiles[0].id}`);
            return;
        }

        // 3. Search for admin user
        if (isServiceKey) {
            console.log("Using Service Key to list users...");
            const { data: users, error: userError } = await supabase.auth.admin.listUsers();
            if (userError) {
                console.error("Error listing users:", userError);
                throw userError;
            }

            const adminUser = users.users.find(u => u.email.includes('admin') || u.email.includes('railify'));

            if (adminUser) {
                console.log(`Found Admin User: ${adminUser.email} (${adminUser.id})`);
                // Upsert profile
                const { error: insertError } = await supabase
                    .from('profiles')
                    .upsert({
                        id: adminUser.id,
                        shop_name: 'Railify',
                        primary_color: '#7C3AED'
                    });

                if (insertError) {
                    console.error("Error upserting profile:", insertError);
                    throw insertError;
                }
                console.log(`FOUND_ID: ${adminUser.id}`);
            } else {
                console.error("No admin user found. Creating one...");
                // Create user
                const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                    email: 'admin@railify.app',
                    password: 'password123',
                    email_confirm: true
                });
                if (createError) throw createError;

                console.log(`Created new Admin User: ${newUser.user.id}`);
                const { error: insertError } = await supabase
                    .from('profiles')
                    .upsert({
                        id: newUser.user.id,
                        shop_name: 'Railify',
                        primary_color: '#7C3AED'
                    });
                console.log(`FOUND_ID: ${newUser.user.id}`);
            }
        } else {
            console.warn("Only Anon Key available. Cannot list users or create admin. Please check .env.local for SUPABASE_SERVICE_ROLE_KEY.");
            // Try to find a user currently logged in? No, script is standalone.
        }

    } catch (e) {
        console.error("Script failed:", e);
    }
}

main();
