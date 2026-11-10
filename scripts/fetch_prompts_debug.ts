import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;

async function fetchPrompts() {
    const client = new Client({ connectionString });
    await client.connect();

    try {
        const res = await client.query('SELECT key, is_active, negative_prompt FROM system_prompts ORDER BY created_at DESC');
        console.log('Prompts in System:');
        console.table(res.rows);
    } catch (err) {
        console.error('Fetch failed:', err);
    } finally {
        await client.end();
    }
}

fetchPrompts();
