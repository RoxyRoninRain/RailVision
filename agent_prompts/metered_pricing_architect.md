# Agent Prompt: Metered Pricing Architect

## Overview
Railify is transitioning from a simple 3-tier subscription model to a sophisticated **5-Tier Metered Pricing System**. This shift treats AI image generation as a utility (like electricity) with base allowances and "Overdrive" capabilities for heavy users.

## Technology Stack
- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS.
- **Backend**: Supabase (PostgreSQL, Auth).
- **Billing Logic**: Custom logic in `src/app/actions` (to be implemented).

## Your Mission
**ACT AS**: Senior Backend Architect & Billing Specialist.
**GOAL**: Implement the "Railify" Metered Pricing System as defined below. FOCUS on the infrastructure, logical controls, and tenant dashboard integration.

---

## SECTION 1: TIER CONFIGURATION
Configure the following 5 Subscription Plans in the code/database:

### Tier 1: "The Estimator" ($49/mo)
- **Included Allowance**: 50 Renders
- **Overage Rate**: $1.00 / extra
- **Onboarding Fee**: $300 (One-time)
- **Embed**: FALSE (Dashboard only)
- **White Label**: FALSE

### Tier 2: "The Shop" ($99/mo)
- **Included Allowance**: 100 Renders
- **Overage Rate**: $1.00 / extra
- **Onboarding Fee**: $300 (One-time)
- **Embed**: TRUE
- **White Label**: FALSE (Widget shows "Powered by Railify")

### Tier 3: "The Pro" ($299/mo) (*Most Popular*)
- **Included Allowance**: 400 Renders
- **Overage Rate**: $0.90 / extra
- **Onboarding Fee**: $250 (One-time)
- **Embed**: TRUE
- **White Label**: TRUE (Client Logo Watermark)

### Tier 4: "The Volume" ($499/mo)
- **Included Allowance**: 700 Renders
- **Overage Rate**: $0.80 / extra
- **Onboarding Fee**: $150 (One-time)
- **Embed**: TRUE
- **White Label**: TRUE
- **Feature**: Priority Processing

### Tier 5: "The Industrial" ($749/mo)
- **Included Allowance**: 1000 Renders
- **Overage Rate**: $0.75 / extra
- **Onboarding Fee**: $0 (Free)
- **Embed**: TRUE
- **White Label**: TRUE
- **Feature**: Dedicated Support

---

## SECTION 2: BILLING & ONBOARDING LOGIC

### 1. Deferred Subscription Start
- **Flow**: User pays Onboarding Fee -> User completes Onboarding Wizard (Logo, Colors) -> Subscription Clock Starts.
- **Goal**: Do not charge the first month's $49-$749 until the tenant is actually "Live".

### 2. The "Soft Cap" Default
- **Logic**: Check `current_usage` vs `included_allowance`.
- **Behavior**: If `usage >= allowance` AND "Overdrive" is FALSE => Return `402 Payment Required`.
- **User Alert**: "Monthly limit reached. Enable Overdrive to keep running."

### 3. "Overdrive" Mode (Overage Handling)
- **Feature Flag**: `enable_overdrive` (Boolean column in `profiles`).
- **Control**: User toggle in Tenant Dashboard (`/dashboard/settings`).
- **Logic**: If `enable_overdrive` is TRUE, allow requests even if `usage > allowance`.
- **Logic**: Track `current_overage_count`.

### 4. Threshold Billing (Facebook Ads Style)
We do NOT wait for the end of the month to charge for large overages. We charge **immediately** when a threshold is hit.

**Thresholds:**
- **Tier 1**: Charge at **50** overages ($50).
- **Tier 2**: Charge at **100** overages ($100).
- **Tier 3**: Charge at **400** overages ($360).
- **Tier 4**: Charge at **700** overages ($560).
- **Tier 5**: Charge at **1000** overages ($750).

**Logic**:
- Inside `generateDesign`:
    - If `usage > allowance`:
        - `current_overage_count++`
        - If `current_overage_count >= tier_threshold`:
            - TRIGGER IMMEDIATE CHARGE (mock or log).
            - Reset `current_overage_count` to 0? OR keep tracking and just mark that chunk as paid? *Decision: Mark chunk as paid, keep tracking total for analytics.*

### 5. "Clean Slate" Monthly Reset
- At the start of the new billing cycle:
    - Charge the **Subscription Fee** for the upcoming month.
    - Charge any **Remaning Pending Overages** (that didn't hit the threshold).
    - **RESET** `current_usage` to 0.
    - **RESET** `current_overage_count` to 0.
    - User starts fresh with their full `included_allowance`.

---

## SECTION 3: UI REQUIREMENTS
### 1. Pricing Page (`/pricing`)
- Update cards to strictly reflect the new prices ($499, $749) and Onboarding Fees.
- Highlight "The Pro" as "Most Popular".

### 2. Tenant Dashboard (`/dashboard`)
- **Usage Bar**: A visual progress bar.
    - **Green**: Within included allowance.
    - **Orange**: In "Overdrive" (Overage) territory.
- **Toggle**: "Enable Overdrive" switch with a clear warning explaining the costs.

---

## Implementation Checklist
1.  [ ] Update `profiles` table schema to support new columns (`tier_name`, `enable_overdrive`, `onboarding_status`, `subscription_start_date`).
2.  [ ] Refactor `src/app/actions/ai.ts` to implement the Threshold Billing Logic.
3.  [ ] Build the "Enable Overdrive" toggle in the Tenant Settings.
4.  [ ] Build the new 5-Card Pricing UI.

**Execute this with precision. The financial integrity of the platform depends on this logic.**
