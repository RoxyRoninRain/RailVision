import { Client } from 'pg';
import fs from 'fs';

const connectionString = process.env.DATABASE_URL;

async function fetchPrompts() {
    const client = new Client({ connectionString });
    await client.connect();

    try {
        console.log("Attempting query...");
        const res = await client.query('SELECT key, is_active, negative_prompt FROM system_prompts ORDER BY created_at DESC');
        console.log('Success!');
    } catch (err: any) {
        console.error('Fetch failed FULL ERROR:', JSON.stringify(err, null, 2));
        fs.writeFileSync('db_error.json', JSON.stringify(err, null, 2));
    } finally {
        await client.end();
    }
}

fetchPrompts();
