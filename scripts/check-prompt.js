const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

async function checkPrompt() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const res = await client.query(`
            SELECT key, is_active FROM system_prompts 
            WHERE is_active = true
        `);
        console.log('Active Prompts:', res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkPrompt();
