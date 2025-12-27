const { Client } = require('pg');

const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

async function activateMainPrompt() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        console.log("Deactivating all prompts...");
        await client.query("UPDATE system_prompts SET is_active = false");

        console.log("Activating 'gemini-handrail-main'...");
        const res = await client.query("UPDATE system_prompts SET is_active = true WHERE key = 'gemini-handrail-main'");

        if (res.rowCount === 1) {
            console.log("SUCCESS: 'gemini-handrail-main' is now the active prompt.");
        } else {
            console.error("ERROR: Could not find/update 'gemini-handrail-main'.");
        }

    } catch (err) {
        console.error('Script Error:', err);
    } finally {
        await client.end();
    }
}

activateMainPrompt();
