# New Agent Handover Prompt

You are an expert software engineer joining an existing project called "MMM Design Studio" (RailVision/Handrail Visualizer).
Your goal is to: **Create a custom "Unlimited" plan for the tenant "Mississippi Metal Magic" that bills for costs only.**

## Project Context

### 1. File Structure
The project file structure is as follows:
```
.agent/
.env.example
.git/
.gitignore
.next/
.vercel/
README.md
migrations/
next.config.ts
package.json
public/
scripts/
src/
  app/
  components/
  config/
  lib/
  middleware.ts
  types/
  utils/
supabase/
tailwind.config.ts
tsconfig.json
```

### 2. Key Files
- **package.json**: Next.js 16 app with Supabase, Stripe (planned), Vertex AI, and Tailwind CSS.
- **src/config/pricing.ts**: Contains the `PRICING_TIERS` object defining existing plans (Estimator, Shop, Pro, Volume, Industrial).
- **src/app/actions/ai.ts**: Handles AI generation and billing logic.
- **src/app/admin/demo-analytics/page.tsx**: Recently added analytics for the landing page demo.

### 3. Tech Stack & Configuration
- **OS**: Windows (User's environment)
- **Framework**: Next.js 16 (App Router)
- **Database**: Supabase (PostgreSQL) + Auth
- **AI**: Google Vertex AI (Gemini 3.0 Pro)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Instructions
1. Analyze the file structure and key file contents above.
2. Adopt the coding style and conventions observed in the existing codebase.
3. Proceed with the user's request:
   > **Task: Implement "Unlimited" Cost-Only Plan**
   >
   > The user's business, **Mississippi Metal Magic** (Tenant ID: likely `d899bbe8-10b5-4ee7-8ee5-5569e415178f`, please verify via `src/app/admin/demo-analytics/page.tsx` or `supabase` query), requires a special subscription plan.
   >
   > 1.  **Update `src/config/pricing.ts`**:
   >     -   Add a new tier named `The Unlimited` (or `Mississippi Metal Magic`).
   >     -   Attributes:
   >         -   `price`: 0 (or a symbolic amount)
   >         -   `allowance`: 999999 (effective unlimited)
   >         -   `overageRate`: Set this to strictly cover **API costs** (Input/Output tokens + Image Gen cost).
   >         -   `features`: Include all features (Embed, Watermark, Priority, etc.).
   >         -   `isWhiteLabel`: true
   >
   > 2.  **Assign Plan**:
   >     -   Create a database migration or run a script to update this specific tenant's `profiles` record to use this new tier.
   >     -   Ensure their billing cycle is set up to charge based on this new "Cost Only" model.
   >
   > 3.  **Verify**:
   >     -   Ensure the dashboard reflects the "Unlimited" status.
   >     -   Test a generation to confirm cost logic works for this tier.
```
