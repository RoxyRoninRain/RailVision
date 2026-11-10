import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;

async function checkSchema() {
    const client = new Client({ connectionString });
    await client.connect();

    try {
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'system_prompts';
        `);

        console.log('Columns in system_prompts:', res.rows.map(r => r.column_name));

        const hasNegative = res.rows.some(r => r.column_name === 'negative_prompt');
        console.log('Has negative_prompt:', hasNegative);

    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        await client.end();
    }
}

checkSchema();
