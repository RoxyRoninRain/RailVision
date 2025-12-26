
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';
const TENANT_ID = 'd899bbe8-10b5-4ee7-8ee5-5569e415178f';

async function checkTier() {
    const client = new Client({
        connectionString,
    });

    try {
        await client.connect();
        // Search for tenants with ID starting with 'cbc' or specific shop name
        const query = `
      SELECT id, tier_name, shop_name, email, logo_url, watermark_logo_url
      FROM profiles 
      WHERE id::text LIKE 'cbc%' OR shop_name ILIKE '%Mississippi%'
    `;

        const res = await client.query(query);
        console.log('Found Tenants:', res.rows);

        if (res.rows.length > 0) {
            console.log('FULL_ID:', res.rows[0].id);
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
