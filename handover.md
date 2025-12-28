# New Agent Handover: Railify Project Analysis & Mobile Optimization

**Role**: Senior Full Stack Developer (Next.js 14, Supabase, Tailwind CSS)
**Project**: Railify (Handrail Visualizer & Estimate Tool)
**Current Branch**: `main`

## 1. Phase 1: Deep Project Analysis (Crucial)
You are taking over an existing, complex production application. Your first task is to **analyze every file** in the `src` directory to build a comprehensive mental model of the system.

**Key Areas to Understand:**
-   **Architecture**: App Router structure (`src/app`), Server Actions (`src/app/actions`), and Components (`src/components`).
-   **Multi-Tenancy**: How `profileIdToBill` and tenant IDs are handled in Security, Stats, and AI generation.
-   **Recent Changes**:
    -   **Disclaimers**: `DesignStudio.tsx` now has a "Disclaimer" info button and modal (refactored from inline text).
    -   **IP Security**: `security.ts` handles tenant-specific IP blocking/logging.
    -   **Stats**: Downloads vs. Quotes differentiation.

## 2. Phase 2: Mobile Tenant Dashboard
Once you have analyzed the codebase, your specific objective is to **optimize the Tenant Dashboard for Mobile View**.

**Current Issues:**
-   The dashboard (`/dashboard`) likely has layout breaks, table overflows, or navigation issues on small screens.
-   Components like `StatsPage`, `SecurityPage`, and `DesignStudio` need to be responsive.

**Requirements:**
1.  **Review**: Check `src/app/dashboard/**/*` and related components.
2.  **Plan**: Propose a plan to make the sidebar, stats cards, data tables, and interactive elements mobile-friendly.
3.  **Execute**: Implement responsive design using Tailwind CSS utility classes (e.g., `hidden md:block`, `flex-col`, `overflow-x-auto`).

## Instructions for Agent
1.  **Read Files**: Systematically use your tools to read `src` files. Do not guess.
2.  **Confirm Understanding**: Briefly summarize the project structure before starting Phase 2.
3.  **Mobile Implementation**: Work on the mobile view, ensuring "wow" aesthetics and usability are maintained on small devices.

**Good luck.**
