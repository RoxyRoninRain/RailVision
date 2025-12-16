import { Client } from 'pg';

const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

const PROMPTS = [
    {
        key: 'gemini-3-optimized-v2',
        system_instruction: `You are a world-renowned architectural visualization expert. Your goal is to produce indistinguishable-from-reality renovations.

**PHASE 1: IMAGE ANALYSIS (Internal Thought)**.
Before drawing, you must analyze the inputs:
1.  **Source Analysis**: Identify the PERSPECTIVE (Two-Point? Vanishing Point?), LIGHTING (Warm/Cool? Direction?), and GEOMETRY.
2.  **Style Analysis**: Identify the HANDRAIL MATERIAL, MOUNTING STYLE, and FINISH quality.

**PHASE 2: IMAGE GENERATION**
Using your analysis, generate a pixel-perfect renovation.

**RULES:**
-   **STRICT KEEP**: You must keep the original stairs, treads, walls, flooring, and background EXACTLY as they are. DO NOT change the camera angle.
-   **STRICT CHANGE**: You must remove the existing handrail (if any) and install the NEW handrail style from the reference image.
-   **REALISM**: Ensure shadows cast by the new railing match the original lighting direction.
-   **OUTPUT**: Return ONLY the generated image. Do not provide text descriptions.`,
        user_template: `[Input: Source Image (The space to renovate), Style Reference Image (The desired handrail design)]
Command: 
1. Determine the VANISHING POINT of the Source Image. Align all new handrail posts to this vertical axis.
2. Analyze the HANDRAIL STYLE of the Reference Image.
3. GENERATE the renovation: Replace the existing handrail in the Source Image with the Handrail Style from the Reference Image.
4. CONSTRAINT: You must STRICTLY preserve the original stair geometry and lighting of the Source Image.

Target Style: "{{style}}"`,
        negative_prompt: `text, watermark, logo, blurry, distorted geometry, floating artifacts, wood railing, existing railing, modified flooring, changing walls, cartoon, illustration, low quality, bad perspective`,
        description: 'Optimized V2: Few-Shot constraints and Explicit Negatives'
    }
];

async function seedPrompts() {
    const client = new Client({ connectionString });
    await client.connect();

    try {
        console.log('Seeding Optimized Prompts...');

        for (const prompt of PROMPTS) {
            console.log(`Processing: ${prompt.key}`);

            // Check existence
            const res = await client.query('SELECT id FROM system_prompts WHERE key = $1', [prompt.key]);

            if (res.rows.length > 0) {
                console.log(`Skipping (Already Exists): ${prompt.key}`);
                // Optional: Update if needed, but for seeding we usually skip or upsert.
                // Let's force update for development iteration
                await client.query(`
                    UPDATE system_prompts 
                    SET system_instruction = $1, user_template = $2, negative_prompt = $3, description = $4, is_active = true
                    WHERE key = $5
                `, [prompt.system_instruction, prompt.user_template, prompt.negative_prompt, prompt.description, prompt.key]);
                console.log('Updated existing prompt.');
            } else {
                await client.query(`
                    INSERT INTO system_prompts (key, system_instruction, user_template, negative_prompt, description, is_active)
                    VALUES ($1, $2, $3, $4, $5, true)
                `, [prompt.key, prompt.system_instruction, prompt.user_template, prompt.negative_prompt, prompt.description]);
                console.log('Inserted new prompt.');
            }

            // Set others inactive
            await client.query(`
                    UPDATE system_prompts 
                    SET is_active = false 
                    WHERE key != $1
                `, [prompt.key]);
            console.log('Deactivated other prompts.');
        }

        console.log('Seeding Complete.');
    } catch (err) {
        console.error('Seeding Failed:', err);
    } finally {
        await client.end();
    }
}

seedPrompts();
