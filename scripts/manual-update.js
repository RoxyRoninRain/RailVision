const { Client } = require('pg');

const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

async function fix() {
    console.log('Connecting...');
    const client = new Client({ connectionString });
    try {
        await client.connect();

        console.log('Fetching profile...');
        const res = await client.query('SELECT id FROM profiles LIMIT 1');
        if (res.rows.length === 0) {
            console.log('No profile found.');
            return;
        }

        const id = res.rows[0].id;
        console.log('Found Profile ID:', id);

        const newWebsite = 'https://mississippimetalmagic.com, https://app.gohighlevel.com';
        console.log(`Updating website to: "${newWebsite}"`);

        await client.query('UPDATE profiles SET website = $1 WHERE id = $2', [newWebsite, id]);
        console.log('Update executed.');

        const verify = await client.query('SELECT website FROM profiles WHERE id = $1', [id]);
        console.log('New Value:', verify.rows[0].website);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

fix();
