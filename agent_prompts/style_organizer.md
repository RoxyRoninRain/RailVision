# Agent Prompt: Visualizer Style Organizer

## Overview
The "Visualizer Styles" (Custom Portfolio) are the heart of the tenant's experience. Currently, they appear in a fixed order (likely by creation date). Tenants need the ability to **curate** this list so their favorite or most popular styles appear first in the public tool.

## Technology Stack
- **Frontend**: Next.js 14+ (App Router), `framer-motion` (Reorder group).
- **Backend**: Supabase (PostgreSQL).
- **Actions**: `src/app/actions` (Server Actions).

## Your Mission
**ACT AS**: Senior Frontend Engineer & UX Specialist.
**GOAL**: Implement a "Drag-and-Drop" reordering system for the Styles Manager.

---

## SECTION 1: DATABASE SCHEMA
1.  **Modify `portfolio` Table**:
    - Add a column: `display_order` (Integer, Default 0).
    - Ensure new styles are added at the end (Max Order + 1).

## SECTION 2: UI IMPLEMENTATION
**Target Files**: 
1. `src/app/dashboard/styles/StylesManager.tsx` (Use this file!).
2. `src/app/admin/styles/page.tsx` (Imports StylesManager - **No changes needed here ideally**).

**NOTE**: The Admin Dashboard reuses the `StylesManager` component. By implementing Drag-and-Drop in `StylesManager.tsx`, you will automatically solve this for both Tenants and Admins.

1.  **Drag & Drop Interface**:
    - Use `framer-motion`'s `Reorder.Group` and `Reorder.Item` components.
    - Replace the current mapped list with a reorderable list.
    - Add a "Drag Handle" icon (from `lucide-react`) to each style card.

2.  **Optimistic UI**:
    - When a user drops an item, **immediately** update the local state.
    - Show a visual indicator that the new order is saving (e.g., "Saving order..." toast or indicator).

3.  **Persist Changes**:
    - Create a Server Action: `reorderStyles(items: { id: string, order: number }[])`.
    - Trigger this action `onReorder` (or debounced).

## SECTION 3: PUBLIC FACING TOOL
**Target File**: `src/app/DesignStudio.tsx` (and `actions.ts`)

1.  **Update Fetch Logic**:
    - Ensure the query that fetches styles for the live tool includes `ORDER BY display_order ASC, created_at DESC`.

---

## Implementation Checklist
1.  [ ] Create migration to add `display_order` column.
2.  [ ] Update `StylesManager.tsx` to support Drag-and-Drop (Framer Motion).
3.  [ ] Create `reorderStyles` server action.
4.  [ ] Verify the public tool reflects the new order.
