# Railify — Project Context & Architecture Memory

## 1. Project Vision & Core Capabilities
**Railify** (`mmm-design-studio`) is a multi-tenant white-label AI handrail & stair railing visualizer and instant linear-foot quote estimator built for custom metal fabricators, ornamental ironwork shops, and railing contractors.
- [x] Multi-tenant embeddable Design Studio widget (`/demo?org=<uuid>`) with tenant branding, domain allowlisting, and watermarking.
- [x] Next-gen Nano Banana 2.1 (`2K`, `thinkingLevel: 'MEDIUM'`, stateful multi-turn Pass 2 with `thoughtSignature`) & Gemini 3.8 Flash (`Scene Router`, `Agentic Vision QA`, `Wizard Slot Validator`, `Fab-Spec Extractor`).
- [x] Self-Serve 4-Step Guided Style Setup Wizard (`Min 5 / Max 8` labeled photo slots, on-screen/pop-up photo coach, editable Fabrication Spec, 3-free-render benchmark calibration, non-destructive legacy upgrade/backfill).
- [x] Server-side `sharp` Pixel-Lock background compositing & watermarking + interactive Before/After wipe slider.
- [x] Metered SaaS billing via Stripe (base tier + per-render metered/promotional/free credits + monthly spend safety caps).
- [x] Instant linear-foot + ZIP-code travel radius estimator & Before/After lead capture via Supabase Storage and Resend.
- [x] Comprehensive Security Hardening & Anti-Hallucination Pipeline Upgrade (Completed & Verified).

---

## 2. Tech Stack & Infrastructure
- **Framework**: Next.js 16.4 (App Router, Server Actions, Middleware) + React 19 + TypeScript 5
- **Styling**: Tailwind CSS 3.4 + Framer Motion + Lucide Icons
- **Database, Auth & Storage**: Supabase (`project_id`: `zlwcdhgdmshtmkqngfzg`, `us-west-2`, `@supabase/ssr`, `@supabase/supabase-js`) — Postgres with RLS, Storage buckets (`portfolio`, `quote-uploads`, `logos`)
- **AI Engine**: Google Cloud Vertex AI (`gemini-nano-banana-2.1` default `2K` + `gemini-3.8-flash` Vision/QA, `@google/genai` + global Vertex REST transport)
- **Payments & Transactional Email**: Stripe (`stripe` v20) + Resend (`resend` v6)
- **Testing & Linting**: Vitest 4 (`jsdom`) + Testing Library + ESLint 9
- **Package Manager**: `npm` (`package-lock.json` — exclusively use `npm`)

---

## 3. Directory & Data-Flow Map
- `src/app/page.tsx` — Marketing landing page with embedded live demo.
- `src/app/demo/page.tsx` — Embeddable multi-tenant Design Studio entry point (validates subscription & Referer/frame-ancestors).
- `src/app/actions/` — Server Actions:
  - `ai.ts` — Main `generateDesign` (validation, IP block/rate-limit, metered billing, Scene Router + cached Clean Plate, Pass 1 `2K`, Agentic Vision QA gating conditional stateful Pass 2, `sharp` pixel-lock compositing + server watermark, Nov 2026 `cost_usd` logging) & `convertHeicToJpg`.
  - `portfolio.ts` — Tenant style CRUD, up-to-8 reference uploads, v2 `labeled_slots` & `fabrication_spec` persistence, auto-derived Pass 2 detail references.
  - `style-wizard.ts` — Live Vision photo slot validation, Fab-Spec extraction, optional Studio Specimen Cutout, allowlisted Benchmark Calibration tester (3 free renders per style), and Admin non-destructive legacy spec backfill.
  - `leads.ts` — `submitLead` & `trackDownload` (quote uploads + Resend notifications).
  - `profile.ts`, `estimate.ts`, `stripe.ts`, `auth.ts`, `contact.ts`, `impersonation.ts`, `stats.ts`.
  - `types.ts` — Shared TypeScript interfaces & `SECOND_PASS_ISSUES` definitions.
- `src/app/admin/` — Super-admin portal (tenant management, prompt lab, bulk style tester, cost analytics, IP security).
- `src/app/dashboard/` — Shop owner portal (leads, styles manager, widget embed snippet, security/IP blocking, billing/spend caps).
- `src/app/api/webhooks/stripe/route.ts` — Stripe webhook handler (checkout bonus credits, renewal invoice overages, usage resets).
- `src/lib/` — Core server & shared utilities:
  - `vertex.ts` — Vertex AI Nano Banana 2.1 (`2K`, `thinkingLevel: 'MEDIUM'`, `thoughtSignature` multi-turn Pass 2) & Gemini 3.8 Flash (`SceneRouter`, `VisionQA` with `codeExecution`, Wizard validation/extraction), plus LRU Clean-Plate cache.
  - `prompts.ts` — Centralized 6-stage modular prompt builders (`PROMPT_STAGE_DEFINITIONS`, fixing square-post bias & `{{image}}`/`{{style}}`/minimal DB stub handling).
  - `model-pricing.ts` — Nov 2026 rate catalog & double-count-safe cost calculators for generation & Admin Cost Intelligence.
  - `image-compositor.ts` — `sharp` Pixel-Lock background preservation compositor & local `public/logo.png` server watermarker (with `<64px` test bypass).
  - `validations.ts` — Zod schemas, SSRF URL/IP validation, image magic-byte & dimension inspection, safe remote image fetching.
  - `rate-limit.ts` — Sliding-window server-side rate limiting for unauthenticated Server Actions.
  - `supabase/` — `server.ts`, `client.ts`, `admin.ts`, `middleware.ts`.
- `supabase/migrations/` — Declarative SQL migrations (RLS policies, billing column triggers, atomic credit consumption RPC).

---

## 4. Active Feature Blueprint: Security Audit Remediation & AI Anti-Hallucination Upgrade

### Objective
Eliminate security vulnerabilities (rate-limit RLS bypass, SSRF redirect bypass, spoofable MIME uploads, PostgREST injection, non-atomic billing races, broken tenant CSP lookup, dependency CVEs) and dramatically improve handrail image generation accuracy with fewer hallucinations.

### Data & API Contracts
- `SECOND_PASS_ISSUES` (`src/app/actions/types.ts`): Add `'direct_mount'` (no bottom shoe rail) and `'reducer_fittings'` (preserve intentional post-top reducer collars) alongside `'reducers'`, `'side_mount'`, `'top_mount'`, and `'shoe_rail'`.
- `detectImageMetadata(buffer)` & `safeFetchImageBuffer(url)` (`src/lib/validations.ts`): Verify JPEG/PNG/WebP/HEIC magic bytes, extract `{ mimeType, width, height, aspectRatio }`, and block HTTP redirects (`redirect: 'error'`) during remote fetches.
- `public.consume_generation_credit(...)` (`supabase/migrations/20261110_atomic_billing_and_security.sql`): Atomic row-locked (`FOR UPDATE`) Postgres RPC for race-free credit/overage deduction with graceful optimistic-concurrency fallback in `ai.ts`.

### Complete File Checklist
- `[CREATE]` `src/lib/rate-limit.ts` — Sliding-window IP rate limiter + safe client IP extraction helper.
- `[CREATE]` `supabase/migrations/20261110_atomic_billing_and_security.sql` — Atomic `consume_generation_credit` RPC & indexes.
- `[MODIFY]` `src/lib/validations.ts` — UUID validator, hardened `isSafeExternalUrl` (hex/octal/mapped-IPv6), `detectImageMetadata` (magic bytes + dimensions + aspect ratio), `safeFetchImageBuffer` (`redirect: 'error'`, timeout, size cap).
- `[MODIFY]` `src/components/security/InputSanitizer.ts` — Support `image/webp` + `validateBuffer` magic-byte verification.
- `[MODIFY]` `src/app/actions/types.ts` — Add `direct_mount` and `reducer_fittings` to `SECOND_PASS_ISSUES`.
- `[MODIFY]` `src/lib/vertex.ts` — Dynamic MIME detection, input aspect-ratio lock, `maxOutputTokens: 8192` headroom, `VERTEX_IMAGE_MODEL` support with fallback, anti-hallucination system/user prompt refinements (removing `"Digital Cleanup"`, adding code-scale & style-room isolation).
- `[MODIFY]` `src/app/actions/ai.ts` — Fix admin-client IP rate limiting for Generic Demo, fix Pass 2 auto-target inversion bug, deduplicate style reference URLs, use `safeFetchImageBuffer` & magic-byte validation, atomic/optimistic billing commit, sanitize client-facing errors.
- `[MODIFY]` `src/app/admin/actions/security.ts` — Validate `tenantId` UUID before `.or()` interpolation.
- `[MODIFY]` `src/app/actions/impersonation.ts` — Validate `tenantId` UUID & auth check on `stopImpersonating`.
- `[MODIFY]` `src/app/actions/auth.ts`, `src/app/actions/contact.ts`, `src/app/actions/leads.ts`, `src/app/actions/profile.ts`, `src/app/actions/portfolio.ts`, `src/app/admin/actions.ts` — Rate limiting, magic-byte validation, and ESLint cleanup.
- `[MODIFY]` `src/lib/supabase/middleware.ts`, `next.config.ts`, `src/app/demo/page.tsx` — Fix tenant `website` CSP lookup under RLS, remove conflicting `X-Frame-Options: SAMEORIGIN`, add security headers, support `'trialing'` status, lower Server Action body limit to `20mb`.
- `[MODIFY]` `src/app/api/webhooks/stripe/route.ts`, `src/lib/auth-helper.ts` — Fail-closed webhook secret/admin client guard; safe temp credential handling.
- `[MODIFY]` `src/app/dashboard/styles/StylesManager.tsx` — Higher-resolution (`1536px`, `0.92`) compression for hardware detail references + ESLint fixes.
- `[MODIFY]` `eslint.config.mjs` & UI pages (`PromptEditor.tsx`, `admin/prompts/page.tsx`, `dashboard/security/page.tsx`, `dashboard/stats/page.tsx`, `onboarding/page.tsx`, `estimate.ts`, `auth-context.ts`) — Clean 0-error ESLint status.
- `[MODIFY]` `package.json` / `package-lock.json` — Remediate `npm audit` vulnerabilities (`sharp`, `uuid`, `minimatch`).
- `[MODIFY]` Existing test mocks (`second-pass-billing.test.ts`, `reducers-and-prompt-specs.test.ts`, `admin-test-style.test.ts`, `security-hardening.test.ts`) + `[CREATE]` `src/test/ai-accuracy-and-security.test.ts` — Comprehensive regression tests.

### Edge Cases & Rollback Note
- Existing unit tests mock `createClient`/`createAdminClient` without `.rpc()`: `ai.ts` checks `typeof (dbClient as any).rpc === 'function'` and falls back cleanly to `from('profiles').update(...)`.
- Preserves all tested fabrication substrings in `vertex.ts` (`POST-TO-RAIL JOINT (DIRECT SEAMLESS WELD)`, `REDUCER FITTINGS REQUIRED`, `SIDE / FASCIA MOUNT`, `TOP / SURFACE MOUNT`).
- Rollback: Revert modified files individually via `git diff` inspection (avoiding `git reset --hard` to preserve pre-existing uncommitted work).

---

## 5. Architecture Decision Records (ADRs)
- **ADR-001**: Enforce `Content-Security-Policy: frame-ancestors` dynamically in `middleware.ts` using server-side service-role lookup for validated UUID `org` params rather than static `X-Frame-Options: SAMEORIGIN`, enabling authorized cross-origin tenant website embeds while keeping `public.profiles` locked down under RLS.
- **ADR-002**: Decouple Pass 1 (holistic staircase renovation & lighting integration) from Pass 2 (targeted hardware/weld micro-refinement with read-only Original Staircase restoration reference), charging metered billing at most once per user-initiated generation.
- **ADR-003**: Tier reasoning effort (`VERTEX_THINKING_LEVEL=MEDIUM` default for Nano Banana 2.1 synthesis/Pass 2, `MINIMAL` for Clean Plate demolition & studio cutouts; `LOW` for fast `gemini-3.8-flash` Scene Router/Photo Validator and `MEDIUM` for Fab-Spec extraction & Agentic Vision QA) while removing deprecated `temperature` overrides for Gemini 3.8 Flash compatibility.
