const { Client } = require('pg');

const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

async function improvePrompt() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        const antiLeakInstruction = `
**CRITICAL: VISUAL HIERARCHY & ANTI-LEAK**
1.  **GEOMETRY (IMAGE A):** You must strictly adhere to the structural perspective, vanishing points, and stair layout of Image A. DO NOT CHANGE THE HOUSE.
2.  **STYLE (IMAGE B):** You may ONLY extract materials (wood stain, metal finish) and parts (spindle shape) from Image B.
3.  **IGNORE COMPOSITION:** If Image B is a grid, collage, or has a different camera angle, **IGNORE IT**. Do not generate a grid. Do not warp your camera. Apply the *materials* of B to the *perspective* of A.
`;

        const newNegative = "grid, collage, multiple images, split screen, text, watermark, warped perspective, structural changes, new walls, new windows, blurry, low quality, distortion";

        // Append to existing instruction or replace?
        // Let's prepend the Critical Anti-Leak to ensure it's seen first/strongly, or append to Truth Hierarchy.
        // I'll fetch first to be safe, but actually a direct update is faster if I know the key 'V6 3image'

        // Actually, let's just prepend it to the existing system instruction.

        console.log('Fetching current prompt...');
        const res = await client.query("SELECT system_instruction FROM system_prompts WHERE key = 'V6 3image'");
        if (res.rows.length === 0) {
            console.error('Prompt V6 3image not found!');
            return;
        }

        let currentSys = res.rows[0].system_instruction;

        // Avoid double adding if ran multiple times
        if (!currentSys.includes('ANTI-LEAK')) {
            const newSys = antiLeakInstruction + "\n" + currentSys;
            console.log('Updating prompt text...');
            await client.query("UPDATE system_prompts SET system_instruction = $1, negative_prompt = $2 WHERE key = 'V6 3image'", [newSys, newNegative]);
            console.log('Prompt updated successfully.');
        } else {
            console.log('Prompt already contains Anti-Leak instruction.');
        }

    } catch (err) {
        console.error('Script Error:', err);
    } finally {
        await client.end();
    }
}

improvePrompt();
