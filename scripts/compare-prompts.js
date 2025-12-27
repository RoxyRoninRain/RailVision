const { Client } = require('pg');

const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

async function comparePrompts() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        const resV6 = await client.query("SELECT * FROM system_prompts WHERE key = 'V6 3image'");
        const resMain = await client.query("SELECT * FROM system_prompts WHERE key = 'gemini-handrail-main'");

        const v6 = resV6.rows[0];
        const main = resMain.rows[0];

        if (!v6 || !main) {
            console.error("One or both prompts not found.");
            return;
        }

        console.log("--- PROMPT COMPARISON ---");
        console.log("V6 3image (User List) vs gemini-handrail-main (Fallback/Good One)\n");

        if (v6.system_instruction === main.system_instruction) {
            console.log("✅ SYSTEM INSTRUCTION: IDENTICAL");
        } else {
            console.log("❌ SYSTEM INSTRUCTION: DIFFERENT");
            console.log("\n[V6 3IMAGE]:\n" + v6.system_instruction.substring(0, 200) + "...");
            console.log("\n[MAIN]:\n" + main.system_instruction.substring(0, 200) + "...");
        }

        if (v6.user_template === main.user_template) {
            console.log("✅ USER TEMPLATE: IDENTICAL");
        } else {
            console.log("❌ USER TEMPLATE: DIFFERENT");
        }

        if (v6.negative_prompt === main.negative_prompt) {
            console.log("✅ NEGATIVE PROMPT: IDENTICAL");
        } else {
            // Treat empty string and null as effectively same for logic, but strictly different for DB
            if ((!v6.negative_prompt && !main.negative_prompt)) {
                console.log("✅ NEGATIVE PROMPT: BOTH EMPTY/NULL");
            } else {
                console.log("❌ NEGATIVE PROMPT: DIFFERENT");
                console.log(`V6: '${v6.negative_prompt}'`);
                console.log(`Main: '${main.negative_prompt}'`);
            }
        }

    } catch (err) {
        console.error('Script Error:', err);
    } finally {
        await client.end();
    }
}

comparePrompts();
