# Handoff: Implement "Style Reference Images" for AI

## Context
Railify is an AI visualizer for metal fabrication shops. Tenants manage "Styles" (e.g., "Modern Horizontal", "Cable Rail") in their dashboard. Currently, a Style has a single `image_url` (displayed to the user) and an optional `gallery` (array of strings, partially implemented).

**The Goal**: We need to allow tenants to **upload hidden reference images** for each style.
- **User Facing**: The user still sees only the main `image_url` in the carousel.
- **AI Facing**: When the AI generates a design, it should receive the main image PLUS these new "Reference Images" to better understand the fabrication details (mounting brackets, corners, finish).

## Your Mission
Implement the "Reference Images" feature end-to-end.

### 1. Database Schema
- **File**: `supabase/migrations/20251220_style_refs.sql` (Create this)
- **Task**: 
    - Verify if the `portfolio` table already has a `gallery` or `reference_images` column.
    - If not, add `reference_images` (text[] array) to store Supabase Storage URLs.
    - If `gallery` exists and is unused, rename it to `reference_images` or just use it.

### 2. Admin Dashboard (Styles Manager)
- **File**: `src/app/dashboard/styles/StylesManager.tsx`
- **Task**:
    - Update the "Add/Edit Style" modal.
    - Add a new "AI Reference Images" section below the main image upload.
    - Allow uploading multiple images (drag & drop or multi-select).
    - Store these images in a dedicated bucket (e.g., `style-references` or existing `portfolio`).
    - Save the URLs to the `portfolio.reference_images` array.
    - **UI Note**: Clearly label this as "Hidden from customers - AI Analysis Only".

### 3. Server Action (AI Generation)
- **File**: `src/app/actions/ai.ts` -> `generateDesign` function.
- **Task**:
    - Locate the logic where `styleInput` is constructed.
    - Currently, it tries to read from `styleData.gallery`.
    - Update it to read from `styleData.reference_images` (or whatever column you settled on).
    - Ensure ALL these images are fetched, converted to Base64, and passed to the `generateDesignWithNanoBanana` function in `src/lib/vertex.ts`.

### 4. Vertex AI Logic
- **File**: `src/lib/vertex.ts` -> `generateDesignWithNanoBanana`
- **Task**:
    - Verify the loop `styleInput.base64StyleImages.forEach(...)` correctly adds these images as `inlineData` parts to the Gemini request.
    - **Prompt Engineering**: The user mentioned "prompt instructions on how to use the extra images".
    - Update the `userTemplate` construction in `src/lib/vertex.ts` (or `src/app/actions/ai.ts`) to explicitly instruct the model:
        > "I have attached multiple Reference Images. Image 1 is the primary style guide. Images 2+ are detailed references for brackets, mounting logic, and textures. specific details. Combine these to generate the most accurate representation."

## Existing Files & Pointers
- **Main AI Action**: `src/app/actions/ai.ts` (Lines 160-220 handle style image loading).
- **Vertex Caller**: `src/lib/vertex.ts` (Lines 90-110 handle the payload construction).
- **Frontend**: `src/app/dashboard/styles/StylesManager.tsx` (Needs the multi-upload UI).

## Deliverables
1.  SQL Migration.
2.  Updated `StylesManager` UI.
3.  Updated `ai.ts` logic.
4.  Verification checklist (Upload 3 refs -> Generate -> Check logs to see 4 images sent to Gemini).
