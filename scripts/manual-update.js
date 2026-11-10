const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

async function fixAll() {
    console.log('Connecting...');
    const client = new Client({ connectionString });
    try {
        await client.connect();

        console.log('Updating ALL profiles...');
        const newWebsite = 'https://mississippimetalmagic.com, https://app.gohighlevel.com';

        const res = await client.query('UPDATE profiles SET website = $1', [newWebsite]);
        console.log(`Updated ${res.rowCount} profiles.`);

        // Verify
        const verify = await client.query('SELECT id, website FROM profiles');
        console.log(JSON.stringify(verify.rows, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

fixAll();
