const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

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
