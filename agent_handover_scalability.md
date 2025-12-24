# Agent Handover: Scalability & Load Testing Research

## Context
Railify is preparing for mass adoption. We need a theoretical stress test and scalability report to understand how our stack will behave under heavy load.

## Scenario
- **Tenants**: 100+ active metal shops.
- **Load**: 100,000+ AI generations per month (approx. 2.3 generations/minute constant, but likely bursty).
- **Stack**: Next.js (Vercel), Supabase (Auth/DB/Storage), Google Vertex AI (Gemini).

## Objective
**Produce a "Scalability Report" (`docs/scalability_report.md`) answering:**

### 1. Database (Supabase)
- **Connections**: With 100k invocations, will Vercel Serverless functions exhaust the Postgres connection limit?
    - *Research*: Are we using the Connection Pooler (PgBouncer) string in `DATABASE_URL`?
- **Storage**: 100k images/mo @ ~1MB each = ~100GB/month.
    - *Research*: Do we have an archival strategy? Is the `leads` table indexed on `organization_id` to handle millions of rows?

### 2. Compute (Vercel)
- **Timeouts**: `generateDesign` calls Vertex AI, which can be slow (10s+). Rails typically 5-15s.
    - *Research*: functionality on Vercel Pro (60s limit). What happens if Vertex hangs?
    - *Research*: Payload limits (4.5MB limit on Vercel Server Actions). We send Base64 images to Vertex. Are we close to this limit?

### 3. AI (Vertex AI / Google Cloud)
- **Quotas**: Gemini Pro has rate limits (QPM).
    - *Research*: What is the default QPM for `gemini-1.5-flash-002` (or current model)? Will 100 concurrent users hit `429 Too Many Requests`?
- **Cost**: 100k generations. Estimate the bill.

## Actionable Output
Create a metric-based report analyzing each bottleneck. Provide recommendations (e.g., "Enable PgBouncer", "Switch to Client-side upload", "Request Quota Increase").

## Resources
- `src/lib/supabase/server.ts` (Connection logic)
- `src/app/actions/leads.ts` (Image handling logic - distinct Base64 vs Storage paths)
- `src/lib/vertex.ts` (AI Payload construction)
