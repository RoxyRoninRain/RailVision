const { Client } = require('pg');

const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

async function testPolicy() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        console.log('--- TESTING AS POSTGRES (ADMIN) ---');
        const resAdmin = await client.query("SELECT key FROM system_prompts WHERE is_active = true");
        console.log('Admin saw:', resAdmin.rows);

        console.log('--- TESTING AS ANON (GUEST) ---');
        // We use a transaction so the SET ROLE only applies to this session/transaction
        await client.query("BEGIN");
        await client.query("SET LOCAL ROLE anon");

        try {
            const resAnon = await client.query("SELECT key FROM system_prompts WHERE is_active = true");
            console.log('Anon saw:', resAnon.rows);
        } catch (err) {
            console.error('Anon Fetch Failed:', err.message);
        }

        await client.query("ROLLBACK");

    } catch (err) {
        console.error('Script Error:', err);
    } finally {
        await client.end();
    }
}

testPolicy();
