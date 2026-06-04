# Task Plan: [Brief Description]
<!-- 
  WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk."
  WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh.
  WHEN: Create this FIRST, before starting any work. Update after each phase completes.
-->

## Goal
<!-- 
  WHAT: One clear sentence describing what you're trying to achieve.
  WHY: This is your north star. Re-reading this keeps you focused on the end state.
  EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality."
-->
Analyze current project state, resolve active authentication/image generation issues, and establish a robust planning workflow for the Handrail Visualizer.

## Current Phase
<!-- 
  WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3").
  WHY: Quick reference for where you are in the task. Update this as you progress.
-->
Phase 1

## Phases
<!-- 
  WHAT: Break your task into 3-7 logical phases. Each phase should be completable.
  WHY: Breaking work into phases prevents overwhelm and makes progress visible.
  WHEN: Update status after completing each phase: pending → in_progress → complete
-->

### Phase 1: Project Discovery & Initialization
<!-- 
  WHAT: Initialize planning files and analyze current project state.
  WHY: To ground future work in accurate context.
-->
- [x] Install planning-with-files skill
- [x] Create planning files (task_plan, findings, progress)
- [x] Analyze findings from conversation history
- [x] Document project stack and current issues in findings.md
- **Status:** complete
<!-- 
  STATUS VALUES:
  - pending: Not started yet
  - in_progress: Currently working on this
  - complete: Finished this phase
-->

### Phase 2: Issue Resolution (Auth & Rendering)
<!-- 
  WHAT: Fix the "DECODER routines::unsupported" error and HEIC input issue.
  WHY: These are immediate blockers preventing the core functionality.
-->
- [x] Investigate `vertex.ts` and Google Cloud credentials format
- [x] Fix "DECODER routines::unsupported" error (Added `formatPrivateKey`)
- [x] Verify HEIC image support (Fixed hardcoded `image/jpeg` bug)
- **Status:** complete

### Phase 3: UX Improvements (Image Viewer)
<!-- 
  WHAT: Implement a side-by-side modal viewer for input and generated images.
  WHY: User reported inability to see full images or compare them.
-->
- [x] Locate results display component
- [x] Implement modal/lightbox component (`SideBySideViewer.tsx`)
- [x] Add side-by-side view (Input vs Result)
- [x] Fix linting errors (duplicate imports)
- **Status:** complete

### Phase 4: Project Maintenance & Updates
<!-- 
  WHAT: Ensure all files and processes are up to date as requested.
  WHY: To maintain a clean, collaborative environment.
-->
- [x] Review and update `task.md` (legacy) if exists
- [x] Update `implementation_plan.md` to reflect current state
- [x] Ensure all experimental prompt files are consistent
- [x] Generate Handover Prompt for Gemini 3 Flash Experiment
- **Status:** complete

### Phase 5: Verification & Delivery
<!-- 
  WHAT: Verify the fixes work.
  WHY: Ensure stability before handing over.
-->
- [x] Verify image generation works (Confirmed by User)
- [x] Verify Image Viewer
- [x] Final review of all planning files
- **Status:** complete

## Key Questions
<!-- 
  WHAT: Important questions you need to answer during the task.
  WHY: These guide your research and decision-making. Answer them as you go.
  EXAMPLE: 
    1. Should tasks persist between sessions? (Yes - need file storage)
    2. What format for storing tasks? (JSON file)
-->
1. What is the specific cause of "DECODER routines::unsupported"? (Suspect Key Format)
2. Is HEIC support a library issue or an API limitation?

## Decisions Made
<!-- 
  WHAT: Technical and design decisions you've made, with the reasoning behind them.
  WHY: You'll forget why you made choices. This table helps you remember and justify decisions.
  WHEN: Update whenever you make a significant choice (technology, approach, structure).
  EXAMPLE:
    | Use JSON for storage | Simple, human-readable, built-in Python support |
-->
| Decision | Rationale |
|----------|-----------|
|          |           |

## Errors Encountered
<!-- 
  WHAT: Every error you encounter, what attempt number it was, and how you resolved it.
  WHY: Logging errors prevents repeating the same mistakes. This is critical for learning.
  WHEN: Add immediately when an error occurs, even if you fix it quickly.
  EXAMPLE:
    | FileNotFoundError | 1 | Check if file exists, create empty list if not |
    | JSONDecodeError | 2 | Handle empty file case explicitly |
-->
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
<!-- 
  REMINDERS:
  - Update phase status as you progress: pending → in_progress → complete
  - Re-read this plan before major decisions (attention manipulation)
  - Log ALL errors - they help avoid repetition
  - Never repeat a failed action - mutate your approach instead
-->
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition
