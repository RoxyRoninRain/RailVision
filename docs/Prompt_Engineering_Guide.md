# Railify Prompt Engineering & Model Guide

## Core Model Configuration
**Model**: `gemini-3-pro-image-preview`
**Region**: `global` (CRITICAL: This model is not available in `us-central1` via standard endpoints yet).
**API Endpoint**: `aiplatform.googleapis.com`

## Prompt Strategy
We utilize a **Forensic Architecture Strategy** that enforces strict preservation and physics compliance through a "Truth Hierarchy".

### System Instruction ("The Truth Hierarchy")
The system prompt defines the AI's role and the absolute priority of inputs.

**Current Live Prompt:**
```text
**ROLE:** You are Railify-AI, an expert Architectural Visualization Engine.

**THE TRUTH HIERARCHY (CRITICAL):**
1.  **IMAGE C (Specs):** The **Physics Truth**. Absolute construction laws.
2.  **IMAGE A (Canvas):** The **Geometry Truth**. Immutable architecture (stairs, walls, lighting).
3.  **IMAGE B (Style):** The **Texture Truth**. Materials and finish only.

**PHYSICS ENGINE:**
Gravity, Shadows, and Occlusion must be perfectly respected.
```

### User Template ("The phased Execution")
The user message constructs the task in 3 strict phases:

**Phase 1: Diagnostic & Demolition**
-   **Analyze**: Check for existing rails.
-   **Action**: If YES, create mask, REMOVE rail, and HEAL background.
-   **Layout**: Determine Single vs Double vs Wall rail based on context.

**Phase 2: Style & Mounting Analysis**
-   **Mounting Logic**: Check Image B/C. Is it Shoe Rail or Direct Mount?
-   **Constraint**: If Direct Mount, NO bottom bar allowed.

**Phase 3: Execution**
-   **Install**: Generate new system on the Nosing Line path.
-   **Preserve**: Do not touch walls/floors outside the rail zone.
```

## Troubleshooting
-   **404 Model Not Found**: Ensure you are using `location: 'global'` and `apiEndpoint: 'aiplatform.googleapis.com'`. Check that `PROJECT_ID` is correct.
-   **HTML Response / Syntax Error**: Often caused by `GOOGLE_APPLICATION_CREDENTIALS` issues. Ensure the environment variable is parsed correctly (handle both file paths and JSON content).
-   **"Generated image is blurry"**: Add "8k resolution, photorealistic, octane render" keywords to the User Template.
-   **"AI changed the stairs"**: Reinforce the "STRICT KEEP" constraint in the System Instruction.

## Testing Tools
Use the provided scripts to validate changes safely:
-   `scripts/test-prompt.js`: Generates an image using current settings.
-   `scripts/analyze-output.js`: Uses Gemini 3 to critique the result significantly.
