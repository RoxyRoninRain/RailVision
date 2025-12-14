# Prompt Tuning Cheat Sheet
**For Admin Dashboard > AI Config**

To fine-tune your results, copy and paste these recommended prompts into the corresponding fields in your Admin Dashboard.

---

## Field 1: System Instruction
**What it does:** Tells the AI acting as the "Brain" how to think and what rules to follow.

### Copy This:
```text
You are a world-renowned architectural visualization expert.

**PHASE 1: IMAGE ANALYSIS (Internal Thought)**.
Before drawing, you must analyze the inputs:
1.  **Source Analysis**: Identify the PERSPECTIVE (camera angle), LIGHTING (direction, color temp), and GEOMETRY (stair pitch, treads, stringers).
2.  **Style Analysis**: Identify the HANDRAIL MATERIAL (e.g., matte black steel, glass), MOUNTING STYLE (side-mount vs. top-mount), and FINISH quality.

**PHASE 2: IMAGE GENERATION**
Using your analysis, generate a pixel-perfect renovation.
-   **STRICT KEEP**: You must keep the original stairs, treads, walls, flooring, and background EXACTLY as they are. DO NOT change the camera angle.
-   **STRICT CHANGE**: You must remove the existing handrail (if any) and install the NEW handrail style from the reference image.
-   **REALISM**: Ensure shadows cast by the new railing match the original lighting direction.
```

### Why this works:
-   **"Internal Thought"**: Forces the AI to "plan" before generating pixels, preventing it from rushing.
-   **"STRICT KEEP"**: Crucial for ensuring the stairs don't morph into a different shape.

---

## Field 2: User Message Template
**What it does:** The specific command sent with the user's photo.

### Copy This:
```text
[Input: Source Image, Style Reference Image]
Command:
1. Analyze the GEOMETRY of the Source Image.
2. Analyze the HANDRAIL STYLE of the Reference Image.
3. GENERATE the renovation by replacing the handrail.
4. CONSTRAINT: STRICTLY preserve the original stair geometry and room lighting.
```

---

## Tuning Tips (How to Fix Common Issues)

| Problem | Solution (Edit System Instruction) |
| :--- | :--- |
| **"The stairs changed shape!"** | Add: `DO NOT CHANGE THE NUMBER OF STEPS OR TREAD MATERIAL.` under **STRICT KEEP**. |
| **"The image looks fake/cartoonish"** | Add: `Output must be a PHOTOREALISTIC 8K OCTANE RENDER.` under **PHASE 2**. |
| **"It ignored the style image"** | Add: `Prioritize the TEXTURES and MATERIALS from the Reference Image over the Source Image.` |
