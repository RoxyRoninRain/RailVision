# Scalability & Load Testing Report
**Generated for:** Railify Engineering Team
**Date:** 2025-12-23
**Target Load:** 100,000 AI generations/month (~100 active tenants)

---

## 1. Database (Supabase / Postgres)
**Status:** 🟡 **MODERATE RISK**

### 1.1 Connection Exhaustion
*   **Finding:** The application uses existing `createClient` from `@supabase/ssr` in `src/lib/supabase/server.ts`. This client communicates via the **Supabase Data API (PostgREST)** over HTTP, not via direct persistent TCP connections to Postgres.
*   **Impact:** Vercel Serverless Functions will **NOT** exhaust the Postgres connection limit because PostgREST manages the connection pool efficiently on the Supabase side.
*   **Verdict:** ✅ Safe. No immediate need for PgBouncer in `DATABASE_URL` unless you introduce an ORM (Prisma/Drizzle) that connects directly.

### 1.2 Storage Scalability
*   **Finding:**
    *   **Volume:** 100k images/mo @ ~1MB = **100TB/year** (incorrect, 100k * 1MB = 100GB/mo = 1.2TB/year). This is within standard Supabase/AWS S3 limits.
    *   **Archival:** There is **NO** archival or cleanup strategy in `src/app/actions/leads.ts`. The `quote-uploads` bucket will grow indefinitely.
*   **Recommendation:** Implement a Lifecycle Policy in Supabase Storage to move objects > 90 days to "Glacier" or delete temp files.
*   **Verdict:** 🟡 Management Strategy Needed.

### 1.3 Database Performance
*   **Finding:** The `leads` table **HAS** an index on `organization_id` (`leads_org_idx` found in `20251211_complete_schema.sql`).
*   **Impact:** Queries filtering by tenant (e.g., `getOwnerLeads`) will remain fast even with millions of rows.
*   **Verdict:** ✅ Scalable.

---

## 2. Compute (Vercel Serverless)
**Status:** 🔴 **HIGH RISK**

### 2.1 Execution Timeouts
*   **Finding:**
    *   Vercel Pro Plan has a **hard timeout of 60 seconds** for Serverless Functions.
    *   `generateDesignWithNanoBanana` (Vertex AI) implements a retry mechanism (3 attempts) with exponential backoff (`sleep`).
    *   **Scenario:** If Gemini hangs for 15s (common under load) + 1 retry (2s sleep + 15s) + overhead, we approach 40-50s. A 2nd retry will likely cause a `504 Gateway Timeout` from Vercel before the code finishes.
*   **Recommendation:** Move AI generation to **Vercel Background Jobs** (long-running) or use an async queue (e.g., Inngest or Supabase Edge Functions) which allow higher timeouts (up to 5 mins or more).

### 2.2 Payload Limits
*   **Finding:**
    *   `next.config.ts` sets `serverActions: { bodySizeLimit: '50mb' }`.
    *   **CRITICAL CONSTRAINT:** While Next.js allows this, **Vercel on AWS Lambda** typically imposes a hard payload header/body limit of **~4.5MB to 6MB**.
    *   We are sending Base64 strings of user images. A 4MB JPEG becomes ~5.4MB Base64. This **WILL FAIL** sporadically or consistently on Vercel Production.
*   **Evidence:** `src/app/actions/leads.ts` checks `file.size > 50MB`, which is effectively useless if the platform blocks it at 6MB.
*   **Recommendation:** **IMMEDIATELY** switch to Client-Side Uploads (Presigned URLs) for standard files. For AI inputs, ensure images are resized/compressed *before* sending to the server, or upload to storage first and send the *URL* to the server action.

---

## 3. AI (Google Vertex AI)
**Status:** 🟡 **REQUIRES ACTION**

### 3.1 Quotas & Rate Limits
*   **Finding:**
    *   Model: `gemini-3-pro-image-preview` (Global Endpoint).
    *   Default Limit: New projects often start with **60-100 QPM** (Queries Per Minute).
    *   **Load:** 100k invocations/mo = ~2.3/min average. However, "bursty" traffic (e.g., 10 users demonstrating at once) could easily spike to >50 QPM.
*   **Recommendation:** Request a Quota Increase for `gemini-3-pro-image-preview` in `us-central1` (or Global) to at least **500 QPM** to handle bursts safely.

### 3.2 Estimated AI Costs (Monthly)
*Assumptions: 100k generations, Gemini 3 Pro pricing (estimated based on Pro tier).*

| Component | usage/gen | Total/Mo | Unit Cost (Est) | Est. Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Input (Image)** | 1 Image | 100,000 | $0.0025 / img | $250 |
| **Input (Text)** | ~2k tokens | 200M tokens | $3.50 / 1M | $700 |
| **Output (Image)** | 1 Image | 100,000 | $0.04 / img | $4,000 |
| **Output (Text)** | ~500 tokens | 50M tokens | $10.50 / 1M | $525 |
| **Total** | | | | **~$5,475 / month** |

*   **Note:** If using `Imagen 3` separately, add ~$4000 (100k * $0.04).
*   **Recommendation:** Ensure your pricing tiers (`src/config/pricing.ts`) cover this. Specifically, "The Estimator" ($49/mo for 50 gens) yields ~$1/gen revenue vs ~$0.05 cost. **Margin is healthy.**

---

## 4. Summary of Recommendations

1.  **[CRITICAL] Payload Fix:** Implement client-side compression or direct-to-storage uploads to bypass Vercel's ~6MB payload limit. The current 50MB config provides false security.
2.  **[HIGH] Timeout Defense:** Refactor `generateDesign` to be asynchronous. The front-end should poll for status or listen to a Supabase Realtime channel, decoupling the UI from the 60s Vercel timeout.
3.  **[MEDIUM] Quota Hike:** Request Google Cloud quota increase for Gemini models.
4.  **[LOW] Storage Hygiene:** Add a cleanup policy for `quote-uploads`.
