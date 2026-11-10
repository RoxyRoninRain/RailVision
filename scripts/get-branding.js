const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

async function run() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const res = await client.query("SELECT logo_url, primary_color FROM profiles WHERE logo_url IS NOT NULL LIMIT 1");
        if (res.rows.length > 0) {
            console.log('---BEGIN---');
            console.log(res.rows[0].logo_url);
            console.log(res.rows[0].primary_color);
            console.log('---END---');
        } else {
            console.log('NONE');
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
