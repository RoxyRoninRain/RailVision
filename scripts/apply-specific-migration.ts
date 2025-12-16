import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

// Using the known connection string
const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

async function runMigration() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Please provide the migration file path relative to project root.');
        process.exit(1);
    }

    const migrationFile = args[0];
    const migrationPath = path.resolve(process.cwd(), migrationFile);

    if (!fs.existsSync(migrationPath)) {
        console.error(`Migration file not found: ${migrationPath}`);
        process.exit(1);
    }

    const client = new Client({
        connectionString,
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log(`Executing migration: ${migrationFile}...`);
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
