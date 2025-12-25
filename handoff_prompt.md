# Security Audit Handover

**Role**: Senior Security Engineer & Full Stack Developer
**Project**: Railify (Next.js 14, Supabase, Stripe, Resend)
**Status**: Pre-launch (Golden Master candidate)

## Objective
Perform a comprehensive security audit of the entire stack to ensure the application is launch-ready, secure against common attacks, and protected against IP theft.

## Context
- **Middleware**: Currently `src/middleware.ts` appears to be disabled/missing (`src/middleware.ts.disabled` exists). This is a **CRITICAL** area to investigate.
- **CI/CD**: No GitHub Actions (`.github` directory missing).
- **Environment**: Next.js App Router, hosted on Vercel. Database on Supabase.

## Audit Checklist

### 1. Codebase & Application Security
- [ ] **Middleware & Auth**:
    - Re-enable and configure `middleware.ts` to protect private routes.
    - Ensure `supabase-ssr` is correctly handling session refreshing.
    - Validate that strictly authenticated routes return 401/403 for unauthenticated users.
- [ ] **Data Validation**:
    - Verify all Server Actions (`src/app/actions`) use Zod (or equivalent) for input sanitization.
    - Check for SQL injection vulnerabilities (ensure we aren't using raw SQL strings with user input).
- [ ] **API Security**:
    - Verify Stripe Webhooks verify signatures (already implemented, but double-check error handling).
    - Rate Limiting: Is there protection against DDoW/Brute force? (Consider `@vercel/kv` or Upstash).

### 2. Database (Supabase)
- [ ] **Row Level Security (RLS)**:
    - Audit **ALL** tables. Ensure no table has RLS disabled.
    - Verify policies are not overly permissive (e.g., `true` for `update`).
    - Specifically check `profiles`, `subscriptions`, and any sensitive user data.
- [ ] **Access Control**:
    - Ensure `service_role` key is **NEVER** exposed to the client.
    - Check if "Expose schema" is enabled for schemas other than `public`.

### 3. Infrastructure & Platform
- [ ] **Vercel**:
    - Review `next.config.ts` for Security Headers (Content-Security-Policy, X-Frame-Options, X-Content-Type-Options).
    - Ensure "Attack Challenge Mode" or Firewall rules are considered for login pages.
- [ ] **GitHub**:
    - Setup Branch Protection rules (require PR review, strict status checks).
    - Enable Dependabot for vulnerability scanning.
    - **IP Protection**: Add a license file (e.g., proprietary/closed source) to the repo root.
- [ ] **Google Cloud / Vertex AI** (if used):
    - Ensure API keys are restricted to specific domains/IPs.
    - Verify OAuth consent screen settings if applicable.

## Deliverables
1.  **Security Audit Report**: A markdown document listing identified vulnerabilities categorized by severity (Critical, High, Medium, Low).
2.  **Fix Implementation**:
    - Re-enable/Fix `middleware.ts`.
    - Apply missing RLS policies.
    - Add security headers to `next.config.ts`.
3.  **Final Verification**: Proof that the app is secure (e.g., "I tried to access /dashboard without login and was redirected").

**"I need to make sure I can't be attacked or copied."**
- **Attacked**: Focus on RLS, Input Validation, and DDoS protection.
- **Copied**: Focus on Legal (License), Code Obfuscation (Client-side, though difficult), and robust Terms of Service.
