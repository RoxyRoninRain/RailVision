# Railify — Engineering Lessons & Gotchas

## Security & Multi-Tenant Supabase Gotchas
1. **RLS Hides `profiles` and `generations` from Anon Clients**:
   - `public.profiles` and `public.generations` restrict `SELECT` to `authenticated` users matching `auth.uid()`.
   - Never use the `anon` Supabase client to count `generations` for IP rate limiting (it always returns `0` for guests!) or to look up tenant `website` domains in `middleware.ts` (it returns `[]`, breaking `frame-ancestors` CSP for embedded widgets). Always validate UUID inputs strictly first and query via `SUPABASE_SERVICE_ROLE_KEY` on the server.
2. **SSRF Redirect Bypass in `fetch()`**:
   - Validating a URL string before calling `fetch(url)` is insufficient because `fetch()` follows HTTP `301`/`302` redirects to internal/cloud-metadata IPs by default. Always pass `redirect: 'error'` and `AbortSignal.timeout(...)` when fetching user-supplied external image URLs.
3. **PostgREST `.or()` String Interpolation**:
   - Never interpolate unvalidated strings into Supabase `.or(...)` filters (e.g., `tenant_id.eq.${tenantId}`), as commas and operators can inject extra filter clauses. Validate strict UUID format first.
4. **Partial `FormData` Boolean Fields (`updateProfile`)**:
   - Never evaluate `formData.get('enable_overdrive') === 'true'` unconditionally when shared `updateProfile` actions are called from multiple forms (e.g. Widget Settings vs Billing Settings); check `formData.has('enable_overdrive')` first so omitted checkboxes don't silently overwrite existing database booleans to `false`.
5. **Unauthenticated `'use server'` Exports**:
   - Every exported function in a `'use server'` file becomes a public HTTP endpoint. Internal helpers like `getActiveSystemPrompt` or `getSystemPrompt` must require an unforgeable `Symbol` (`INTERNAL_PROMPT_TOKEN`) or `checkIsAdmin()`.

## Vertex AI / Nano Banana Image Generation Gotchas
1. **`maxOutputTokens: 2048` Causes Text-Only Generation Failures**:
   - Gemini 3 / Nano Banana image models consume internal `thought` tokens plus ~1,120–1,680 tokens for the generated image. Capping `maxOutputTokens` at `2048` starves image emission and triggers `"Model returned text/thoughts instead of image"`. Keep `maxOutputTokens` at `8192`.
2. **Never Grant `"Digital Cleanup"` Permission on Immutable Scene Layers**:
   - Telling an image model it may perform `"Digital Cleanup" (remove trash/tools)` invites hallucinated erasure of homeowner decor, plants, moldings, and furniture. Background pixels outside the handrail mask must be strictly immutable.
3. **Pass 2 Auto-Target Polarity**:
   - In `SECOND_PASS_ISSUES`, `'reducers'` means *"remove unwanted reducers and flush-weld posts to the rail"* (`hasReducers === false`), whereas `hasReducers === true` requires `'reducer_fittings'` (preserving intentional stem collars). Never map `hasReducers === true` to `'reducers'`.
4. **Deduplicate Style Reference URLs**:
   - Legacy portfolio items may include `image_url` inside `reference_images` as well. Sending duplicate full-room style photos increases style-background bleed into the customer's staircase canvas.
5. **Preserve Legacy Test Compatibility & Partial Mocks in `ai.ts` / `image-compositor.ts`**:
   - Unit tests (`ai-accuracy-and-security.test.ts`, `second-pass-billing.test.ts`) partially mock `@/lib/vertex` with only `generateDesignWithNanoBanana`, `refineDesignWithNanoBanana`, and `assembleRefinementPrompt`, assert exact `.usage` object keys (`{ inputTokens, outputTokens }`), spy on `global.fetch` count, and pass 14–24 byte synthetic JPEGs.
   - Always guard optional `vertex.ts` vision exports via `getOptionalModuleFn` (`try/catch`), read `public/logo.png` from disk (`fs.promises.readFile`) instead of `fetch()`, bypass `sharp` cleanly on `<64px` buffers, keep `result.usage` keys strict, and never overwrite legacy `image_url` or require `wizard_mode: 'v2'` 5-slot validation on non-wizard legacy forms.
6. **Gemini 3.6+ / 3.8 Flash & Nano Banana 2.1 API Parameter Constraints**:
   - Gemini 3.8 Flash deprecates `temperature`, `top_p`, and `top_k` (supplying them triggers HTTP `400`); omit sampling overrides and tune via `thinkingConfig.thinkingLevel` (`LOW`/`MEDIUM`/`HIGH`) instead.
   - Nano Banana 2.1 accepts `MINIMAL`, `MEDIUM` (default), or `HIGH` (controlled via `VERTEX_THINKING_LEVEL`), NOT `LOW`; use `MINIMAL` for simple Clean Plate demolition and canonical studio cutouts. Also route Vertex `gemini-3.8-flash` through `getVertexClient(true)` (`location: 'global'`), and export `maxDuration = 120` on interactive App Router style/studio routes so Vercel serverless functions don't time out.

## Visualizer UX Gotchas
1. **Step 3 Result Display (`DesignStudio.tsx` + `BeforeAfterSlider.tsx`)**:
   - Step 3 must always default to showing 100% of the newly generated design (`showOriginalComparison === false` renders the full `<img src={result} />`) with a two-button segmented toggle (`New Design` | `Compare Before / After`).
   - Do NOT open `<BeforeAfterSlider />` first (or set `initialPosition` past 50%, like the old `62%`), because masking the majority of the frame with the original staircase photo makes customers think nothing changed. Keep `BeforeAfterSlider` `initialPosition = 35` so 65% of the new design remains visible on open.
