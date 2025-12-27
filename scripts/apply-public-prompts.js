const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

async function applyMigration() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('Connected to DB. Applying migration...');

        const sql = `
        -- Allow public (anon + authenticated) read access to ACTIVE system prompts
        DROP POLICY IF EXISTS "Allow public read access to active prompts" ON system_prompts;
        
        CREATE POLICY "Allow public read access to active prompts"
        ON system_prompts
        FOR SELECT
        TO public
        USING (is_active = true);
        `;

        await client.query(sql);
        console.log('Migration applied successfully.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

applyMigration();
