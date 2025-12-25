
You are taking over a Next.js 14 + Supabase project "Railify".

**Current Status:**
- Admin features (Tenants, Styles, Onboarding Access) are implemented but have bugs/UX issues.
- The user suspects they deleted data in `logos` and `admin-assets` buckets (Confirmed: Buckets are empty).
- Admin Dashboard has frequent session timeouts.

**Priorities (Execute in Order):**

1. **Verify & Fix Admin Session Timeouts:** 
   - User reports "keeps kicking me off". 
   - Investigate `src/lib/supabase/client.ts` and `src/components/SignOutButton.tsx`.
   - Ensure the session refresh logic works. Check if `supabase.auth.onAuthStateChange` is handling token refreshes correctly or if middleware is aggressive.

2. **Verify Logo & Watermark Logic:**
   - **Landing Page:** Verify `src/app/page.tsx` and `src/components/Navbar.tsx`. Ensure `/logo.png` exists in `public/`.
   - **Visualizer Watermark:** Open `src/components/design-studio/DesignStudio.tsx`.
   - The function `compositeWatermark` (line 206) handles baking the logo. 
   - **Issue:** It seems to depend on `tenantProfile.watermark_logo_url` or files in the now-empty storage buckets. 
   - **Action:** If buckets are empty, the watermark will fail/disappear. You may need to help the user re-upload or implement a hard-coded fallback for the demo.

3. **Implement "Safe" Admin Asset Viewers:**
   - **Problem:** Currently, "View Onboarding Assets" etc. link to Supabase Dashboard. User fears deleting data.
   - **Task:** Create internal admin pages (e.g., `/admin/tenants/[id]/assets`) to view these files safely using your existing server actions (public read access is enabled on buckets).
   - Update `src/app/admin/tenants/[id]/page.tsx` to link to these new pages instead of Supabase.

4. **Data Restoration (Guidance):**
   - The `logos` and `portfolio` buckets are empty. You cannot restore deleted files, but you should guide the user to re-upload the **Admin Logo** (`/logo.png` in public might be fine, but tenant logos are gone).
   - Check if the "Demo Tenant" (ID: `d899bbe8-10b5-4ee7-8ee5-5569e415178f`) has a logo set in the `profiles` table. If it points to a missing file, updates are needed.

**Context:**
- **OS:** Windows
- **Stack:** Next.js 14 (App Router), Supabase (Auth, DB, Storage), Tailwind, Lucide Icons.
- **Critical Files:** `src/app/admin/tenants/[id]/page.tsx`, `src/components/design-studio/DesignStudio.tsx`, `scripts/check-storage-hardcoded.js` (Created to verify emptiness).

Good luck.
