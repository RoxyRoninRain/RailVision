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
- **Embed**: FALSE (Dashboard only)
- **White Label**: FALSE

### Tier 2: "The Shop" ($99/mo)
- **Included Allowance**: 100 Renders
- **Overage Rate**: $1.00 / extra
- **Embed**: TRUE
- **White Label**: FALSE (Widget shows "Powered by Railify")

### Tier 3: "The Pro" ($299/mo) (*Most Popular*)
- **Included Allowance**: 400 Renders
- **Overage Rate**: $0.90 / extra
- **Embed**: TRUE
- **White Label**: TRUE (Client Logo Watermark)

### Tier 4: "The Volume" ($500/mo)
- **Included Allowance**: 700 Renders
- **Overage Rate**: $0.80 / extra
- **Embed**: TRUE
- **White Label**: TRUE
- **Feature**: Priority Processing

### Tier 5: "The Industrial" ($750/mo)
- **Included Allowance**: 1000 Renders
- **Overage Rate**: $0.75 / extra
- **Embed**: TRUE
- **White Label**: TRUE
- **Feature**: Dedicated Support

---

## SECTION 2: METERED BILLING LOGIC
You must implement the following business logic in the backend actions.

### 1. The "Soft Cap" Default
- **Logic**: Check `current_usage` vs `included_allowance`.
- **Behavior**: If `usage >= allowance` AND "Overdrive" is FALSE => Return `402 Payment Required`.
- **User Alert**: "Monthly limit reached. Enable Overdrive to keep running."

### 2. "Overdrive" Mode (Overage Handling)
- **Feature Flag**: `enable_overdrive` (Boolean column in `profiles`).
- **Control**: User toggle in Tenant Dashboard (`/dashboard/settings`).
- **Logic**: If `enable_overdrive` is TRUE, allow requests even if `usage > allowance`.
- **Billing**: Calculate `(request_count - allowance) * tier_overage_rate` and track as `pending_overage_balance`.

### 3. Risk Management
- **Interim Billing**: If `pending_overage_balance > $100`, trigger logic for an immediate charge (mock or log this event).
- **Hard Cap**: Allow users to set a `max_monthly_spend` (e.g., "Stop at $500 total").

---

## SECTION 3: UI REQUIREMENTS
### 1. Pricing Page (`/pricing`)
- Display 5 cards with the specific copy and details above.
- Highlight "The Pro" as "Most Popular".
- Clear distinction between "Monthly Subscription" and "Overage Rate".

### 2. Tenant Dashboard (`/dashboard`)
- **Usage Bar**: A visual progress bar.
    - **Green**: Within included allowance.
    - **Orange**: In "Overdrive" (Overage) territory.
- **Toggle**: "Enable Overdrive" switch with a clear warning explaining the costs.

### 3. Billing View
- **Invoice Display**: Clearly separate:
    - "Subscription Fee" (Next Month / Forward-looking)
    - "Overage Fees" (This Month / Backward-looking)

---

## Implementation Checklist
1.  [ ] Update `profiles` table schema to support new columns (`tier_name`, `enable_overdrive`, `pending_overage`, `max_spend`).
2.  [ ] Refactor `src/app/actions/ai.ts` to implement the Soft Cap & Overdrive logic.
3.  [ ] Build the "Enable Overdrive" toggle in the Tenant Settings.
4.  [ ] Build the new 5-Card Pricing UI.
5.  [ ] Update the Dashboard Widget to show the "Metered" status bar.

**Execute this with precision. The financial integrity of the platform depends on this logic.**
