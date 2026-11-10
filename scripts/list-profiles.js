const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

async function list() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const res = await client.query('SELECT id, email, shop_name FROM profiles');
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

list();
