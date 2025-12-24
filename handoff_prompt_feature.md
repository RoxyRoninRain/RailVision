# Agent Handover: Implement Admin Demo Analytics

## Context
Railify is a B2B SaaS for metal fabricators. The landing page (`/`) features a live embedded demo of the design studio. We need to track who is using this demo and what they are generating, visible from the Admin Dashboard.

- **Stack**: Next.js 14, Supabase, Tailwind CSS.
- **Admin Layout**: `src/app/admin/layout.tsx` (Server) & `src/app/admin/AdminLayoutClient.tsx` (Client Nav).
- **Data Source**: The `leads` table in Supabase.
- **Demo Organization ID**: `d899bbe8-10b5-4ee7-8ee5-5569e415178f`
    - Any lead/generation created by the landing page demo is tagged with this ID.

## Your Mission
Create a new section in the Super Admin Dashboard to view usage data specifically from the Landing Page Demo.

## Step-by-Step Task List

### 1. Create the Page
Create a new page at `src/app/admin/demo-leads/page.tsx`.
- **Access**: Use `createClient` from `@/lib/supabase/server`.
- **Query**: Select all rows from `leads` where `organization_id` equals `d899bbe8-10b5-4ee7-8ee5-5569e415178f`.
- **Sort**: Newest first (`created_at` descending).

### 2. Build the UI
Display the data in a clean, dark-themed table (matching existing Admin UI).
- **Columns to Show**:
    - **Date**: Format readable (e.g., "Oct 24, 2:30 PM").
    - **Customer Email**: (If provided, otherwise "Anonymous").
    - **Customer Name**: (If provided).
    - **Style Selected**: (`style_name`).
    - **Generated Image**: Display a small thumbnail of `generated_design_url`. Link to open full size.
    - **Status**: Display a badge for status (New/Contacted/etc).

### 3. Update Navigation
Modify `src/app/admin/AdminLayoutClient.tsx`:
- Add a new Link in the sidebar navigation:
    - **Label**: "Demo Leads"
    - **Href**: `/admin/demo-leads`
    - **Icon**: Use `MonitorPlay` or `Presentation` from `lucide-react`.

## Important Implementation Details
- **Lead Type Definition**: You can assume the `Lead` type structure from `src/app/actions/types.ts` or infer it from the DB query.
- **Security**: The Admin Layout already handles auth checks. You just need to fetch the data.
- **Design System**: Use the existing color palette (Black backgrounds `#0a0a0a`, Dark Gray borders `#333`, White text).

## Example Query
```typescript
const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('organization_id', 'd899bbe8-10b5-4ee7-8ee5-5569e415178f')
    .order('created_at', { ascending: false });
```

Good luck!
