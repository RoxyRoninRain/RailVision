# Agent Architecture Guide

This directory acts as the "Cortex" for the AI Developer. It enforces rules, maintains memory, and guides workflows.

## 📂 Directory Structure

### 1. `/workflows` (Standard Operating Procedures)
*Triggered by slash commands to execute complex tasks.*
- `init-project.md`: Trigger `/init`. Sets up the project rules and memory.
- `feature-kickoff.md`: Trigger `/plan`. Plans and builds new features.

### 2. `/memory` (Long-Term Context)
*Read/Write files that persist project knowledge.*
- `project-summary.md`: The PRD. Vision, stack, and status.
- `structure.md`: The file map of the source code.
- `lessons.md`: Mistakes to avoid and patterns to follow.
- `decisions.md`: Architecture Decision Records (ADR).
- `scratchpad.md`: **Ignored by Git**. Active thinking space for the current task.

### 3. `/rules` (The Constitution)
*Read-only constraints.*
- `tech-stack.md`: Approved languages and libraries.
- `quality-standards.md`: Coding style, error handling, and testing rules.
- `security-privacy.md`: Security protocols (no secrets in code).
- `git-conventions.md`: Commit message styles and branching.

### 4. `/templates` (The Blueprints)
*Schemas used to generate consistent files.*
- `code-module.md`: Universal structure for source code files.
- `test-suite.md`: Universal structure for tests.
- `pull-request.md`: Checklist for PR descriptions.
- `readme.md`: Template for the project root README.

## 🚀 How to Start
1. **Initialize**: Run `/init` to configure the agent for this specific project.
2. **Build**: Run `/plan [feature description]` to start coding.



# Agent Architecture: The Master Structure

## 📂 File Tree
```text
.agent/
├── system-prompt.md            <-- The "Boot" file (Copy-paste this to start)
│
├── workflows/                  <-- The Automation
│   ├── init-project.md         <-- Trigger: /init (Setup Wizard)
│   └── feature-kickoff.md      <-- Trigger: /plan (Building features)
│
├── memory/                     <-- The Brain
│   ├── project-summary.md      <-- The PRD (Vision, Stack, Status)
│   ├── lessons.md              <-- The Auto-Correction Log
│   ├── structure.md            <-- The Site Map
│   ├── decisions.md            <-- Architecture Records (ADRs)
│   └── scratchpad.md           <-- Active thinking space (GitIgnored)
│
├── rules/                      <-- The Constitution
│   ├── tech-stack.md           <-- Allowed languages/libs
│   ├── quality-standards.md    <-- Coding style & errors
│   ├── security-privacy.md     <-- Safety & secrets
│   └── git-conventions.md      <-- Commit messages & branching
│
└── templates/                  <-- The Blueprints
    ├── code-module.md          <-- Universal file structure
    ├── test-suite.md           <-- Universal testing pattern
    ├── readme.md               <-- Documentation starter
    └── pull-request.md         <-- PR Description form