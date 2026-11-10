import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

// Creds from apply-migration.ts
const connectionString = process.env.DATABASE_URL;

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
