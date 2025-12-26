const { Client } = require('pg');

const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';
// Tenant ID for Mississippi Metal Magic
const TENANT_ID = 'cbc0da2d-7db3-4d42-890e-86256f18378d';
const NEW_TIER = 'The Unlimited';

async function assignPlan() {
    const client = new Client({
        connectionString,
    });

    try {
        await client.connect();

        // 1. Find Tenant ID dynamically to avoid copy-paste errors
        const findQuery = `SELECT id, shop_name FROM profiles WHERE shop_name ILIKE '%Mississippi%' LIMIT 1`;
        const findRes = await client.query(findQuery);

        if (findRes.rows.length === 0) {
            console.error('Error: Could not find tenant matching "Mississippi"');
            process.exit(1);
        }

        const targetId = findRes.rows[0].id;
        const shopName = findRes.rows[0].shop_name;
        console.log(`Found tenant: ${shopName} (${targetId})`);

        console.log(`Assigning '${NEW_TIER}' to ${targetId}...`);

        const query = `
      UPDATE profiles
      SET 
        tier_name = $1,
        enable_overdrive = true,
        subscription_status = 'active',
        subscription_start_date = NOW()
      WHERE id = $2
      RETURNING *;
    `;

        const res = await client.query(query, [NEW_TIER, targetId]);

        if (res.rows.length > 0) {
            console.log('Success! Updated profile:', res.rows[0]);
        } else {
            console.error('Error: Tenant not found or update failed.');
        }

    } catch (err) {
        console.error('Database error:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

assignPlan();
