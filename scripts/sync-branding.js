const { Client } = require('pg');

const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

async function sync() {
    console.log('Connecting...');
    const client = new Client({ connectionString });
    try {
        await client.connect();

        console.log('Syncing branding to ALL profiles...');

        // Use a self-join/subquery to update all rows with the "good" values
        const updateQuery = `
            UPDATE profiles 
            SET 
                logo_url = (SELECT logo_url FROM profiles WHERE logo_url IS NOT NULL LIMIT 1),
                primary_color = (SELECT primary_color FROM profiles WHERE primary_color <> '#FFD700' LIMIT 1),
                shop_name = 'Mississippi Metal Magic'
            WHERE true;
        `;

        const res = await client.query(updateQuery);
        console.log(`Updated ${res.rowCount} profiles.`);

        // Verify
        const verify = await client.query('SELECT id, logo_url, primary_color FROM profiles');
        console.log(JSON.stringify(verify.rows, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

sync();
