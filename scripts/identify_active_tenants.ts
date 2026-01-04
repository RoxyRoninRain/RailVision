import { Client } from 'pg';
import fs from 'fs';

const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

async function identifyTenants() {
    const client = new Client({
        connectionString,
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        // Query to find active tenants (leads in last 30 days) and their full profile details
        const query = `
            SELECT DISTINCT l.organization_id, p.*
            FROM leads l
            LEFT JOIN profiles p ON l.organization_id = p.id
            WHERE l.created_at >= NOW() - INTERVAL '30 days';
        `;

        const res = await client.query(query);

        console.log('Active Tenants (Last 30 Days):');
        console.log('Found ' + res.rows.length + ' tenants.');

        console.log('Writing clean JSON to active_tenants_clean.json...');
        fs.writeFileSync('active_tenants_clean.json', JSON.stringify(res.rows, null, 2));

    } catch (err) {
        console.error('Error querying database:', err);
    } finally {
        await client.end();
    }
}

identifyTenants();
