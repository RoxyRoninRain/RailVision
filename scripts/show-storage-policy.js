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

async function applyPolicy() {
    console.log("=== Applying Storage RLS Policy ===");

    const sql = `
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow public uploads to quote-uploads'
        ) THEN
            create policy "Allow public uploads to quote-uploads"
            on storage.objects for insert
            to public
            with check ( bucket_id = 'quote-uploads' );
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow public usage of quote-uploads'
        ) THEN
            create policy "Allow public usage of quote-uploads"
            on storage.objects for select
            to public
            using ( bucket_id = 'quote-uploads' );
        END IF;
    END
    $$;
    `;

    // Note: supabase-js doesn't have a direct 'rpc' for raw SQL unless you have a stored procedure.
    // However, the Service Role key often allows direct API interaction if we use the right endpoint.
    // BUT, supabase-js standard client doesn't support raw SQL execution.
    // WE HAVE TWO OPTIONS:
    // 1. Ask the User to run the SQL in Supabase Dashboard.
    // 2. Try to use the Postgres connection string if available (unlikely).
    // 3. Just tell the User.

    // WAIT! I can use the `postgres` library if installed, OR just guide the user.
    // Actually, I can't execute RAW SQL with the JS client unless I have a function `exec_sql(query text)`.

    // Check if we can use a known function or if I should just stop and ask the user.
    // I will try to instruct the user.

    console.log("\n!!! CANNOT EXECUTE SQL DIRECTLY WITH JS CLIENT !!!");
    console.log("Please run the following SQL in the Supabase Dashboard SQL Editor:");
    console.log("---------------------------------------------------");
    console.log(sql);
    console.log("---------------------------------------------------");
}

applyPolicy();
