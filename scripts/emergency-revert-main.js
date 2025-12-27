const { Client } = require('pg');

const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

async function revertMainPrompt() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        // This is the EXACT text recovered from the logs (Steps 566 & 631)
        const originalSystemInstruction = `You are a world-renowned architectural visualization expert. Your goal is to produce indistinguishable-from-reality renovations.

**PHASE 1: IMAGE ANALYSIS (Internal Thought)**.
Before drawing, you must analyze the inputs:
1.  **Source Analysis**: Identify the PERSPECTIVE (camera angle), LIGHTING (direction, color temp), and GEOMETRY (stair pitch, treads, stringers), existing handrail (if any), and surrounding environment (walls, floor).
2.  **Style Analysis**: Identify the MATERIAL (wood species, metal finish), FORM (post thickness, baluster shape), and MOUNTING rules (tread mount vs stringer mount) from the Reference Image.

**PHASE 2: EXECUTION**
1.  **DEMOLITION**: Mentally remove the existing handrail (if any) and install the NEW handrail style from the reference image.
2.  **REALISM**: Ensure shadows cast by the new railing match the original lighting direction.
3.  **INTEGRATION**: The connection points to the floor/treads must be physically plausible.

**CRITICAL CONSTRAINTS**:
-   **GEOMETRY LOCK**: You must STRICTLY preserve the original stair geometry, walls, flooring, and background of the Source Image. DO NOT change the camera angle.
-   **NO HALLUCINATIONS**: Do not invent new windows, doors, or furniture.`;

        const originalUserTemplate = `[INPUTS]
**IMAGE A (Source):** [User's Staircase]
**IMAGE B (Style Reference):** [Style Reference Image]

***
Command: 
1. Analyze the GEOMETRY of the Source Image (stairs, walls, lighting).
2. Analyze the HANDRAIL of the Reference Image. Focus ONLY on the railing materials, shape, infill and mounting hardware. Ignore the flooring, walls, or other elements in the reference.
3. GENERATE the renovation: Replace the existing handrail in the Source Image (if any) with the Handrail Style from the Reference Image.
4. CONSTRAINT: You must STRICTLY preserve the original stair geometry and lighting of the Source Image.`;

        console.log('REVERTING gemini-handrail-main to ORIGINAL state...');

        await client.query(`
            UPDATE system_prompts 
            SET system_instruction = $1, 
                user_template = $2 
            WHERE key = 'gemini-handrail-main'
        `, [originalSystemInstruction.trim(), originalUserTemplate.trim()]);

        console.log('SUCCESS: Prompt reverted to the "Good Results" version.');

    } catch (err) {
        console.error('Script Error:', err);
    } finally {
        await client.end();
    }
}

revertMainPrompt();
