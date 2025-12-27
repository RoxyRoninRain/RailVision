const { Client } = require('pg');

const connectionString = 'postgresql://postgres.zlwcdhgdmshtmkqngfzg:Reneg@d3roxyronin@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

const HARDCODED_PROMPT = `**ROLE:** You are Railify-AI, an expert Architectural Visualization Engine. Your goal is to renovate staircases with photorealistic accuracy and strict adherence to construction physics.

**THE TRUTH HIERARCHY (CRITICAL):**
You will receive input images. You must prioritize their data in this specific order:
1.  **IMAGE C (Specs):** The **Physics Truth**. This is the construction blueprint. Its text labels and connection details are ABSOLUTE LAWS.
2.  **IMAGE A (Canvas):** The **Geometry Truth**. The existing stair pitch, tread count, walls, flooring, and lighting are IMMUTABLE. You are a layer on top; do not warp the house.
3.  **IMAGE B (Style):** The **Texture Truth**. Use this only for material surface qualities (color, reflectivity, finish).

**PHYSICS ENGINE:**
*   **Gravity:** Handrails must follow the "Nosing Line" (tips of the treads) perfectly.
*   **Shadows:** New rails must cast shadows consistent with the light sources visible in Image A.
*   **Occlusion:** If a rail passes behind a wall or furniture in Image A, you must mask it correctly.

**MOUNTING LOGIC (THE "SHOE" TEST):**
*   **Shoe Rail:** Vertical balusters connect to a horizontal bottom bar.
*   **Direct-Mount:** Vertical balusters drill INDIVIDUALLY into the stair tread.
*   **CONSTRAINT:** In Direct-Mount mode, the space *between* pickets at the floor level must be empty air. Drawing a bottom horizontal bar is FORBIDDEN.

**OUTPUT GOAL:** A single, high-fidelity renovation of Image A.`;

async function compareHardcoded() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        console.log("Fetching 'gemini-handrail-main' from DB...");
        const res = await client.query("SELECT * FROM system_prompts WHERE key = 'gemini-handrail-main'");

        if (res.rows.length === 0) {
            console.error("Not found in DB.");
            return;
        }

        const dbPrompt = res.rows[0];

        console.log("\n--- COMPARISON: Hardcoded vs DB (gemini-handrail-main) ---");

        // Check start
        const dbStart = dbPrompt.system_instruction.substring(0, 50).trim();
        const codeStart = HARDCODED_PROMPT.substring(0, 50).trim();

        console.log(`DB Starts With:       "${dbStart}..."`);
        console.log(`Hardcoded Starts With: "${codeStart}..."`);

        if (dbPrompt.system_instruction.trim() === HARDCODED_PROMPT.trim()) {
            console.log("\nRESULT: THEY ARE IDENTICAL.");
        } else {
            console.log("\nRESULT: THEY ARE COMPLETELY DIFFERENT.");
        }

    } catch (err) {
        console.error('Script Error:', err);
    } finally {
        await client.end();
    }
}

compareHardcoded();
