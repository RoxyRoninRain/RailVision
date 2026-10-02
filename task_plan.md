# Task Plan: Second-Pass Style Refinement Pipeline

## Goal
Implement a complete end-to-end Second-Pass AI Refinement feature in the Style Manager and AI generation pipeline. Each style can enable a second-pass refinement with issue-specific toggles (e.g. Reducers/Direct Weld, Shoe Rail, Side Mount) plus optional custom refinement instructions, executed automatically or selectively during generation.

---

## Phases & Status

- [x] **Phase 1: Architecture & Type Definitions**
  - Defined `SecondPassConfig`, `StyleMetadata`, and `SECOND_PASS_ISSUES` in `src/app/actions/types.ts`.
  - Standardized issue keys (`reducers`, `shoe_rail`, `side_mount`) and their pre-defined prompts.
  - Standardized base preservation prompt in `vertex.ts`.
- [x] **Phase 2: Backend Generation Pipeline (`vertex.ts` & `ai.ts`)**
  - Implemented `refineDesignWithNanoBanana` and `assembleRefinementPrompt` in `src/lib/vertex.ts`.
  - Wired up second-pass execution in `generateDesign` (`src/app/actions/ai.ts`).
  - Integrated token usage tracking and generation audit logging.
- [x] **Phase 3: Portfolio Data Handling (`portfolio.ts`)**
  - Supported reading and writing `second_pass` configuration in `portfolio.style_metadata` in `createStyle` and `updateStyle`.
- [x] **Phase 4: Style Manager UI (`StylesManager.tsx`)**
  - Added "✨ Second-Pass AI Refinement" UI section in both Add Style and Edit Style modals.
  - Master checkbox: "Enable Second-Pass AI Refinement".
  - Interactive issue cards for pre-configured issues (Reducers, Shoe Rail, Side Mount).
  - Textarea: "Custom Refinement Prompt (Optional)".
  - Added "✨ Pass 2 Active" status badge to style list items.
- [x] **Phase 5: Admin Style Tester UI (`TenantStyleTester.tsx`)**
  - Added 3-way toggle ("Use Style Default", "Force Pass 2", "Pass 1 Only (Skip)").
  - Added "✨ Pass 2" badge to style cards.
  - Added "Pass 2 Applied" status badge in diagnostics footer.
- [x] **Phase 6: Testing & Verification**
  - Unit tests created in `src/test/second-pass-refinement.test.ts` (all passed).
  - All 24 tests across 8 test suites passed.
  - Verified `Rainier - TM - Round Top` updated in production database.
  - Production Next.js build compiled successfully in 11.8s.
