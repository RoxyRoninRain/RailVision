import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;

async function checkSchema() {
    const client = new Client({ connectionString });
    await client.connect();

    try {
        console.log('Querying information_schema.columns...');
        const res = await client.query(`
            SELECT table_schema, table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'system_prompts';
        `);

        if (res.rows.length === 0) {
            console.log('Table system_prompts NOT FOUND in any schema.');
        } else {
            console.table(res.rows);
        }

    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        await client.end();
    }
}

checkSchema();
