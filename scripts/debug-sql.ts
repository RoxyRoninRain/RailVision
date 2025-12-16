import { Client } from 'pg';

const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

async function runRawDebug() {
    const client = new Client({ connectionString });
    await client.connect();

    try {
        // 1. Check all columns
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'system_prompts'
        `);
        console.log('COLUMNS FOUND:', res.rows.map(r => r.column_name + ' (' + r.data_type + ')'));

        // 2. Try simple select
        try {
            const res2 = await client.query('SELECT negative_prompt FROM system_prompts LIMIT 1');
            console.log('SELECT negative_prompt SUCCESS');
        } catch (e: any) {
            console.log('SELECT negative_prompt FAILED:', e.message);
        }

    } catch (err: any) {
        console.error('Debug Failed:', err.message);
    } finally {
        await client.end();
    }
}

runRawDebug();
