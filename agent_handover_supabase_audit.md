# Agent Handover: Supabase Security & Performance Audit

## Context
We are preparing the Railify application for launch. As part of the hardening process, we need to address any outstanding warnings in our Supabase database.

## Objective
**Audit and Fix Supabase Security and Performance Advisors.**

## Tools Available
You have access to the **Supabase MCP Server**. You must use it to fetch the warnings directly.
- `mcp_supabase-mcp-server_get_advisors`: Use this to list issues.
- `mcp_supabase-mcp-server_execute_sql`: Use this to inspect tables or run quick fixes (carefully).
- `mcp_supabase-mcp-server_apply_migration`: **Preferred** way to apply permanent schema changes (like new indexes or RLS policies).

## Specific Tasks

### 1. Security Audit
**Action**: Run `get_advisors` with type `security`.
**Focus**:
- **Row Level Security (RLS)**: Ensure RLS is ENABLED on all public tables.
- **Policies**: Verify that policies exist and are not overly permissive (auditing "publicly readable" warnings).
- **Pitfalls**: Watch out for recursive policies that cause infinite recursion errors.

### 2. Performance Audit
**Action**: Run `get_advisors` with type `performance`.
**Focus**:
- **Unindexed Foreign Keys**: Add indexes to any foreign key columns to improve join performance.
- **Bloat / Vacuum**: efficient vacuum settings (though mostly managed by Supabase, checks can be useful).

### 3. Implementation
- For every fix, create a **new migration file** in `supabase/migrations/` (e.g., `20251224_security_fixes.sql`).
- Apply the migration using the `apply_migration` tool.
- **Verify**: Re-run `get_advisors` to confirm the list is empty.

## Reference
- **Project Context**: `handoff_prompt.md` provides overview of the tables (`generations`, `portfolio`, `profiles`, etc.).
