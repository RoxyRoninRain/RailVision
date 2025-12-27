# New Agent Handover Prompt

You are an expert software engineer joining an existing project called **Railify (MMM Design Studio)**.
Your goal is to: **Continue refining the AI Generation pipeline, specifically focusing on the `gemini-handrail-main` prompt to reduce hallucinations.**

## Project Context

### 1. File Structure
The project file structure is as follows:
```
.agent/
.env.local
package.json
tsconfig.json
src/
  app/
    actions/
      ai.ts (Main billing/generation logic)
    admin/ (Admin dashboard)
    dashboard/ (Tenant dashboard)
    demo/ (Embedded tool entry point)
  lib/
    vertex.ts (Vertex AI/Gemini integration logic - CRITICAL)
  components/
    design-studio/
      DesignStudio.tsx (Main UI, Watermark logic)
scripts/ (Helper scripts for DB/Prompt management)
supabase/ (Migrations)
```

### 2. Key Files
- **`src/lib/vertex.ts`**: Handles the connection to Google Vertex AI. It constructs the payload (Image A, B, C) and sends the System Prompt.
- **`src/components/design-studio/DesignStudio.tsx`**: The frontend wizard. Contains the `compositeWatermark` function (recently fixed to 0.9 opacity).
- **`package.json`**:
  - `next`: ^16.0.10
  - `@google-cloud/vertexai`: ^1.10.0
  - `@supabase/supabase-js`: ^2.87.1
  - `stripe`: ^20.1.0

### 3. Tech Stack & Configuration
- **OS**: Windows
- **Framework**: Next.js 14+ (App Router)
- **Database**: Supabase (PostgreSQL) + RLS
- **AI**: Google Vertex AI (Gemini 3.0 Pro)
- **Billing**: Stripe (Metered Usage)

## Recent Changes & Current State
1.  **AI Prompts (CRITICAL):**
    - The system uses a specific prompt key: `'gemini-handrail-main'` (The "World-Renowned Expert" persona).
    - **Status:** **RESTORED TO ORIGINAL "GOOD" STATE.**
    - **Action Required:** The prompt text is currently the "Original Good Version" (recovered from logs). It has **NOT** been modified to handle Image C yet.
    - **Issue:** Occasionally hallucinates by replacing the room structure.

2.  **Watermark:**
    - Opacity set to `0.9` (Fixed).

3.  **RLS Policies:**
    - `anon` access enabled for active prompts.

## Instructions
1.  **Brainstorming Goal (DO NOT EDIT PROMPT YET):** The user wants to improve the prompt to handle "Image C" better, which is often a "4-in-1 collage" or zoom-ins.
2.  **Specific User Feedback Phase:**
    - "Brainstorm the best way to tell the model to **only** use Image C to identify specific details."
    - "Constraint: Image C is 4 images in one... zoom in on sections... different environment."
    - "Do NOT use Image C for geometry/room structure."
3.  **Next Step:** Propose a text update to the user for the prompt that incorporates these specific constraints *before* applying it.
4.  **Monitor Hallucinations:** Use `temperature: 0.9` (Default).
