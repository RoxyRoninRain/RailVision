const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Credentials found in scripts/apply-migration.ts
const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

async function runMigration() {
    console.log('Connecting to database...');
    const client = new Client({
        connectionString,
    });

    try {
        await client.connect();
        console.log('Connected.');

        const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20251216_force_schema_fix.sql');
        console.log('Reading migration file:', migrationPath);
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Executing SQL...');
        const res = await client.query(sql);
        console.log('Migration applied successfully.');
        console.log(res);

        // Verification Query
        console.log('Verifying column exists...');
        const verifyRes = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'profiles' AND column_name = 'website';
        `);
        console.log('Verification Result:', verifyRes.rows);

    } catch (err) {
        console.error('Error applying migration:', err);
    } finally {
        await client.end();
    }
}

runMigration();
