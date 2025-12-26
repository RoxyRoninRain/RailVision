
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';
const TENANT_ID = 'd899bbe8-10b5-4ee7-8ee5-5569e415178f';

async function checkTier() {
    const client = new Client({
        connectionString,
    });

    try {
        await client.connect();
        console.log(`Checking tier for tenant: ${TENANT_ID}...`);

        const query = `
      SELECT id, tier_name, enable_overdrive, current_usage, watermark_logo_url, logo_url 
      FROM profiles 
      WHERE id = $1
    `;

        const res = await client.query(query, [TENANT_ID]);

        if (res.rows.length > 0) {
            console.log('Current Tenant State:', res.rows[0]);
        } else {
            console.error('Error: Tenant not found.');
        }

    } catch (err) {
        console.error('Database error:', err);
    } finally {
        await client.end();
    }
}

checkTier();
