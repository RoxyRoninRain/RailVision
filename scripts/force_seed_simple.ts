import { Client } from 'pg';

const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

const OPTIMIZED_PROMPT = {
    key: 'gemini-3-optimized-v2',
    description: 'Advanced prompt with Few-Shot, Geometry Anchors, and Structured Chains.',
    system_instruction: `You are an expert Architectural Visualization AI specialized in modifying staircase photos.
Your GOAL: Transform the handrail/railing in the input image to match the provided style reference, while strictly preserving the original staircase geometry, perspective, and lighting.

### CRITICAL GEOMETRY RULES
1.  **Vanishing Point Alignment**: Identify the vanishing points of the original staircase steps. The new handrail MUST converge to the same vanishing points.
2.  **Occlusion Handling**: If the original railing is behind a wall or post, the new railing must also be behind it.
3.  **Scale Matching**: The height of the handrail must be standard (approx 36-42 inches relative to steps). Do not make it cartoonishly large or invisible.

### STYLE TRANSFER
-   Analyze the "Style Image" for material (e.g., Brushed Steel, Oak, Glass), chaotic vs. clean lines, and joint details.
-   Apply strictly these materials to the new form.

### OUTPUT COMPOSITION
-   Return ONLY the modified image.
-   Do not crop the image. Keep original dimensions.`,
    user_template: `Input Image: {{image}}
Style Reference: {{style}}

Task: Replace the existing handrail with the style shown in the reference.
-   Keep the stairs exactly as they are.
-   Keep the background exactly as it is.
-   Ensure the new handrail casts realistic shadows onto the stairs.`,
    negative_prompt: `text, watermark, logo, blurry, distorted geometry, floating objects, extra legs, broken stairs, cartoon, sketch, painting, bad perspective`
};

async function forceSeed() {
    const client = new Client({ connectionString });
    await client.connect();

    try {
        console.log(`Seeding ${OPTIMIZED_PROMPT.key}...`);

        // Check if exists
        const check = await client.query('SELECT key FROM system_prompts WHERE key = $1', [OPTIMIZED_PROMPT.key]);

        if (check.rows.length > 0) {
            console.log('Prompt exists. Updating...');
            await client.query(`
                UPDATE system_prompts 
                SET system_instruction = $1, user_template = $2, negative_prompt = $3, description = $4, is_active = true
                WHERE key = $5
            `, [OPTIMIZED_PROMPT.system_instruction, OPTIMIZED_PROMPT.user_template, OPTIMIZED_PROMPT.negative_prompt, OPTIMIZED_PROMPT.description, OPTIMIZED_PROMPT.key]);
        } else {
            console.log('Creating new...');
            await client.query(`
                INSERT INTO system_prompts (key, system_instruction, user_template, negative_prompt, description, is_active)
                VALUES ($1, $2, $3, $4, $5, true)
            `, [OPTIMIZED_PROMPT.key, OPTIMIZED_PROMPT.system_instruction, OPTIMIZED_PROMPT.user_template, OPTIMIZED_PROMPT.negative_prompt, OPTIMIZED_PROMPT.description]);
        }

        console.log('SUCCESS: Prompt seeded and set to active.');

    } catch (err: any) {
        console.error('SEED FAILED:', err.message);
        console.error(JSON.stringify(err, null, 2));
    } finally {
        await client.end();
    }
}

forceSeed();
