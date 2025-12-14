# Railify Prompt Engineering & Model Guide

## Core Model Configuration
**Model**: `gemini-3-pro-image-preview`
**Region**: `global` (CRITICAL: This model is not available in `us-central1` via standard endpoints yet).
**API Endpoint**: `aiplatform.googleapis.com`

## Prompt Strategy
We utilize a **Hybrid Prompting Strategy** that combines Persona, Chain-of-Thought (CoT), and Explicit Multi-Modal References.

### System Instruction ("The Brain")
The system prompt should define the AI's role and force it to "think" before "drawing".

**Best Practice Pattern:**
```text
You are a world-renowned architectural visualization expert.

**PHASE 1: IMAGE ANALYSIS (Internal Thought)**.
Before drawing, you must analyze the inputs:
1.  **Source Analysis**: Identify PERSPECTIVE, LIGHTING, and GEOMETRY.
2.  **Style Analysis**: Identify HANDRAIL MATERIAL, MOUNTING, and FINISH.

**PHASE 2: IMAGE GENERATION**
-   **STRICT KEEP**: Original stairs, treads, walls, flooring.
-   **STRICT CHANGE**: Remove old handrail, install NEW style.
-   **REALISM**: Match lighting and shadows.
```

### User Template ("The Input")
The user message constructs the specific task using the provided images.

**Best Practice Pattern:**
```text
[Input: Source Image, Style Reference Image]
Command:
1. Analyze GEOMETRY of Source Image.
2. Analyze HANDRAIL STYLE of Reference.
3. GENERATE renovation.
4. CONSTRAINT: STRICTLY preserve original geometry.
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
