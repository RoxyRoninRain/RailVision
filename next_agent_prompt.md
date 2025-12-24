# Agent Handover: RailVision (Railify) Optimization

We are optimizing the "Railify" web application (Next.js 14, Supabase, Google Vertex AI).

## Context
This app allows users to upload a photo of their stairs, select a "Style" from a carousel, and see an AI-generated renovation. Shop owners (Tenants) manage these styles in their dashboard.

## Current Objective
We need to refined the **Styles Manager** UI and Data processing.
*Note: Landing Page refined (Hero/Pricing copy updated, 'How It Works' removed). Contact & Legal pages live.*

## Tasks
Please execute the following updates in order:

### 1. Remove Blurry Watermarks
**Subject**: `src/app/dashboard/styles/StylesManager.tsx` (and potentially `src/utils/imageUtils.ts` or `src/app/actions.ts`).
**Goal**: We identified that the "watermark" image overlay on style cards might be blurry or intrusive.
**Action**:
-   Locate the logic that overlays the user's logo as a watermark on the style image.
-   **Remove it completely** from the visual preview. We want clean, unobstructed style images.

### 2. Fix Style Editor Aspect Ratio
**Subject**: `src/app/dashboard/styles/StylesManager.tsx` (The "Edit Style" Modal).
**Goal**: The image cropper/preview in the Edit Menu is currently a wide rectangle, which causes poor framing for our square output targets.
**Action**:
-   Locate the "Edit Style" modal key component (look for `<EditStyleModal>`).
-   Update the image container/cropper UI to enforce a **1:1 Square Aspect Ratio**.
-   Ensure that when the user drags/zooms the image, they are framing a square.

## Tech Stack References
-   **Frontend**: Next.js 14, Tailwind CSS, Framer Motion.
-   **Files**: `src/app/dashboard/styles/StylesManager.tsx` is the primary file for both tasks.
