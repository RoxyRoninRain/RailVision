import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

// Creds from apply-migration.ts
const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

async function runMigration() {
    const client = new Client({
        connectionString,
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20251224_security_perf_fixes.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Executing fix migration...');
        console.log(sql);

        await client.query(sql);
        console.log('Migration applied successfully.');
    } catch (err) {
        console.error('Error applying migration:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
