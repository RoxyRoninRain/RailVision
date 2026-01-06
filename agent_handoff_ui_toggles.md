# Agent Task: Investigate & Implement Explicit Style Toggles

**Objective**:
Transition the application from "Pure AI Extraction" (guessing style details from images) to "Explicit User Definition" (using UI toggles for critical variables).
This is to solve the issue where the AI occasionally hallucinates or misinterprets technical details like Shoe Rails vs Direct Mount.

**Context**:
Currently, the user uploads a "Style Image" (Image B) and the AI tries to guess:
1.  Is there a bottom rail (Shoe Rail)?
2.  What is the post style (Box vs Turned)?
3.  What is the termination (Volute vs Post-to-Post)?

**The Goal**:
Add explicit toggles (Booleans/Enums) to the **Style Manager UI**. When a user creates/edits a Style, they explicitly define these traits. These traits are then injected directly into the Prompt sent to Vertex AI, overriding the AI's "guesswork".

**Required Investigation & Implementation Plan**:

1.  **Database Schema (`portfolio` table)**
    *   Add columns for technical specs. Suggested:
        *   `has_bottom_rail` (boolean): Enforces Shoe Rail vs Direct Mount.
        *   `post_style` (enum/text): 'box', 'turned', 'iron', etc.
        *   `termination_style` (enum/text): 'volute', 'post-to-post', 'lambs-tongue'.

2.  **UI Updates (`StylesManager.tsx` / Style Editor Modal)**
    *   Add UI switches/dropdowns for these new fields when adding/editing a style.
    *   Ensure these save correctly to Supabase.

3.  **Prompt Entry Point (`verify src/lib/vertex.ts` / `src/app/actions/ai.ts`)**
    *   Modify the logic that constructs the user prompt.
    *   Instead of asking the AI to "Phase 2: Extract Design", **INJECT** the known design facts.
    *   *Example Prompt Injection:*
        ```text
        **TECHNICAL SPECS (STRICT):**
        *   **MOUNTING:** SHOE RAIL (Bottom Bar Required) - [Derived from DB: true]
        *   **POSTS:** BOX NEWEL - [Derived from DB: 'box']
        ```

4.  **Verification**
    *   Check if explicit constraints reduce "hallucinations" (e.g., does setting `has_bottom_rail=false` 100% prevent the Ghost Spindle issue?).

**Deliverables**:
*   Schema migration SQL.
*   Updated UI components.
*   Updated Prompt Generation Logic.
