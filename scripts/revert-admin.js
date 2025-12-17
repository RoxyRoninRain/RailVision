const { Client } = require('pg');

const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

async function revertAdmin() {
    console.log('Connecting...');
    const client = new Client({ connectionString });
    try {
        await client.connect();

        console.log('Reverting Admin Profile...');
        const adminId = 'd899bbe8-10b5-4ee7-8ee5-5569e415178f';

        await client.query(`
            UPDATE profiles 
            SET 
                shop_name = 'Railify',
                logo_url = NULL,
                primary_color = '#FFD700',
                website = 'https://railify.com'
            WHERE id = $1
        `, [adminId]);

        console.log('Admin reverted.');

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

revertAdmin();
