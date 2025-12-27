const { Client } = require('pg');

const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

async function revertPrompt() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        // The text I added previously (exactly as defined in improve-prompt.js)
        const antiLeakInstruction = `
**CRITICAL: VISUAL HIERARCHY & ANTI-LEAK**
1.  **GEOMETRY (IMAGE A):** You must strictly adhere to the structural perspective, vanishing points, and stair layout of Image A. DO NOT CHANGE THE HOUSE.
2.  **STYLE (IMAGE B):** You may ONLY extract materials (wood stain, metal finish) and parts (spindle shape) from Image B.
3.  **IGNORE COMPOSITION:** If Image B is a grid, collage, or has a different camera angle, **IGNORE IT**. Do not generate a grid. Do not warp your camera. Apply the *materials* of B to the *perspective* of A.
`;

        // Note: improve-prompt.js did: const newSys = antiLeakInstruction + "\n" + currentSys;
        // So we look for antiLeakInstruction + "\n" and remove it.

        console.log('Fetching current prompt...');
        const res = await client.query("SELECT system_instruction FROM system_prompts WHERE key = 'V6 3image'");
        if (res.rows.length === 0) {
            console.error('Prompt V6 3image not found!');
            return;
        }

        let currentSys = res.rows[0].system_instruction;
        const textToRemove = antiLeakInstruction + "\n";

        if (currentSys.includes(antiLeakInstruction.trim())) {
            // Use more robust replacement in case whitespace varied slightly (though it shouldn't have)
            // I'll try exact replacement first.
            if (currentSys.startsWith(textToRemove)) {
                const originalSys = currentSys.replace(textToRemove, '');
                console.log('Found exact prefix match. Reverting...');

                // Also revert negative_prompt to NULL (or empty string, originally it was likely NULL or empty)
                // Based on logs, it was 'None', which usually means null/undefined in my logger logic.

                await client.query("UPDATE system_prompts SET system_instruction = $1, negative_prompt = NULL WHERE key = 'V6 3image'", [originalSys]);
                console.log('Prompt successfully reverted to original state.');
            } else {
                // Fallback: maybe just replace the trimmed version if the newline got weird?
                console.warn('Prefix mismatch. Attempting flexible removal...');
                const originalSys = currentSys.replace(antiLeakInstruction, '').trim();
                // Note: simple trim might be dangerous if original started with whitespace, but usually fine.
                await client.query("UPDATE system_prompts SET system_instruction = $1, negative_prompt = NULL WHERE key = 'V6 3image'", [originalSys]);
                console.log('Prompt reverted (flexible match).');
            }

        } else {
            console.log('Prompt DOES NOT contain the Anti-Leak instruction. It might have already been reverted.');
        }

    } catch (err) {
        console.error('Script Error:', err);
    } finally {
        await client.end();
    }
}

revertPrompt();
