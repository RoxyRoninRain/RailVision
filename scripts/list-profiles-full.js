const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

async function list() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const res = await client.query('SELECT id, email, shop_name FROM profiles');
        const fs = require('fs');
        // ...
        let output = '';
        res.rows.forEach(row => {
            output += `ID: ${row.id}\nEmail: ${row.email}\nShop: ${row.shop_name}\n---\n`;
        });
        fs.writeFileSync('profiles.txt', output);
        console.log('Wrote to profiles.txt');
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

list();
