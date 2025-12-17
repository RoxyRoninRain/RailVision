const { Client } = require('pg');

const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

async function inspect() {
    console.log('Connecting...');
    const client = new Client({ connectionString });
    try {
        await client.connect();

        console.log('Querying profiles...');
        const res = await client.query("SELECT id, shop_name, logo_url FROM profiles WHERE id IN ('d899bbe8-10b5-4ee7-8ee5-5569e415178f', 'cbc0da2d-7db3-4d42-93e8-404d38912364')");
        fs.writeFileSync('profiles.json', JSON.stringify(res.rows, null, 2));
        console.log('Wrote to profiles.json');

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

inspect();
