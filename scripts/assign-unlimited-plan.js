
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';
const TENANT_ID = 'd899bbe8-10b5-4ee7-8ee5-5569e415178f';
const NEW_TIER = 'The Unlimited';

async function assignPlan() {
    const client = new Client({
        connectionString,
    });

    try {
        await client.connect();
        console.log(`Connected to database. Assigning '${NEW_TIER}' to ${TENANT_ID}...`);

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

        const res = await client.query(query, [NEW_TIER, TENANT_ID]);

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
