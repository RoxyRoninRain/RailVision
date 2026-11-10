import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const connectionString = process.env.DATABASE_URL;

async function runMigration() {
    const client = new Client({
        connectionString,
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        const migrationPath = path.join(process.cwd(), 'migrations', '20251222_metered_pricing.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Executing migration...');
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
