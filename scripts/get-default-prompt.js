const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

async function fetchDefaultPrompt() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        console.log("Fetching fallback prompt key: 'gemini-handrail-main'...");

        const res = await client.query("SELECT * FROM system_prompts WHERE key = 'gemini-handrail-main'");

        if (res.rows.length === 0) {
            console.error("Prompt 'gemini-handrail-main' NOT FOUND in database!");
        } else {
            const p = res.rows[0];
            console.log("--- FOUND PROMPT ---");
            console.log("KEY:", p.key);
            console.log("IS_ACTIVE:", p.is_active);
            console.log("\n[SYSTEM INSTRUCTION]\n");
            console.log(p.system_instruction);
            console.log("\n[USER TEMPLATE]\n");
            console.log(p.user_template);
            console.log("\n[NEGATIVE PROMPT]\n");
            console.log(p.negative_prompt || "NULL");
        }

    } catch (err) {
        console.error('Script Error:', err);
    } finally {
        await client.end();
    }
}

fetchDefaultPrompt();
