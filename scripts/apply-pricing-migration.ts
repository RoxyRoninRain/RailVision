import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

// Using the same connection string as the original script
const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

async function runMigration() {
    const client = new Client({
        connectionString,
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20251218_add_pricing_estimates.sql');

        if (!fs.existsSync(migrationPath)) {
            console.error('Migration file not found:', migrationPath);
            process.exit(1);
        }

        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Executing migration 20251218_add_pricing_estimates.sql...');
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
