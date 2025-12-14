# Handoff Guide for RailVision (Railify)

## Overview
RailVision (rebranded to **Railify**) is a B2B SaaS platform for metal fabrication shops. It allows shop owners ("Tenants") to embed a high-end AI visualizer on their website.
- **Visualizer Tool**: Visitors upload a photo of their stairs/deck and visualize different handrail styles.
- **Tenant Dashboard**: Shop owners manage their leads (people who used the tool), configure their branding, and manage the styles available in the visualizer carousel.
- **Admin Dashboard**: Super Admins manage tenants and global AI prompts.

## Technology Stack
- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Framer Motion.
- **Backend/Db**: Supabase (Auth, PostgreSQL, Storage, Row Level Security).
- **AI/ML**: 
    - **Google Vertex AI (Gemini 3.0 Pro / "Nano Banana")**: Used for both image analysis and generation.
    - **Actions**: `src/app/actions.ts` contains the core server actions for generation.

## Core Features & Logic

### 1. Design Studio (The Visualizer)
- **File**: `src/app/DesignStudio.tsx`
- **Location**: Root path `/` (Publicly accessible).
- **Logic**:
    - Users upload a "Scene" (their stairs).
    - Users select a "Style" (from the carousel).
        - **Presets**: Industrial, Modern, etc. (Default images).
        - **Custom**: Tenants can upload their own portfolio images.
    - **Generation**: The app calls `generateDesign` (Server Action).
    - **CRITICAL**: The generated Prompt combines:
        1. A "System Instruction" (from Admin DB).
        2. A "User Template" (from Admin DB).
        3. The visual data of the **User's Scene**.
        4. The visual data of the **Selected Style** (we explicitly fetch the style image URL and pass it to the model so it can "see" the reference).

### 2. Portfolio Management (Carousel Sync)
- **Role**: Tenants manage the images shown in the Visualizer Carousel.
- **File**: `src/app/dashboard/styles/StylesManager.tsx`
- **Logic**:
    - Styles are stored in the `portfolio` table in Supabase.
    - New tenants are auto-seeded with 5 default styles.
    - Tenants can "Hide" or "Delete" defaults and upload their own.
    - The `DesignStudio` component automatically fetches the tenant's specific styles based on the URL or logged-in session.

### 3. Prompt Management
- **Role**: Admins fine-tune the AI's behavior without code changes.
- **File**: `src/app/admin/prompts/page.tsx`
- **Logic**:
    - Prompts are stored in the `system_prompts` table.
    - Key prompt: `gemini-handrail-main`.
    - Modify the "System Instruction" (Persona/Role) and "User Template" (Task) here to improve output quality.

## Instructions for the Next Agent

### Your Mission
Your primary goal is to **Analyze and Fine-Tune the AI Prompts** to achieve photorealistic, architecturally accurate results that strictly adhere to the uploaded geometry while applying the new style.

### Resources
- **Admin Dashboard**: `/admin/prompts` (Use this to edit prompts live).
- **Files to Study**: 
    - `src/lib/vertex.ts` (How we call Google Vertex AI).
    - `src/app/actions.ts` (How we construct the payload).

### Best Practices for Gemini 3.0 ("Nano Banana")
1.  **Multi-Modal Inputs**: We are already sending both the Scene Image and the Style Image. Your prompts should explicitly refer to them (e.g., "Analyze the geometry in Image A and apply the texture from Image B").
2.  **Chain of Thought**: Encourage the model to "Plan" before generating. (e.g., "First, identify the vanishing points. Second, mask the handrail area...").
3.  **Persona**: Use a strong persona (e.g., "World-class Architectural Visualizer").
4.  **Negative Prompting**: Explicitly list what to avoid (e.g., "Do not alter the stairs geometry", "Do not add background noise").

### Workflow for You
1.  Read the current prompt in the Admin Dashboard.
2.  Test the tool with various difficult angles (stairs, decks).
3.  Iterate on the prompt in the Admin Dashboard.
4.  Create a guide/document with your findings, successful prompt patterns, and "before/after" examples.

**Good luck! Build something magical.**
