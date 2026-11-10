-- ============================================================================
-- ATOMIC BILLING & RLS LOCKDOWN MIGRATION (2026-11-10)
-- 1. Atomic row-locked RPC (`consume_generation_credit`) preventing concurrent
--    double-spending of free/discounted credits and monthly spend-cap bypasses.
-- 2. Lock down `generations` INSERT to service_role only (preventing anon IP-rate-limit DoS spoofing).
-- 3. Lock down `system_prompts` SELECT to super-admins only (protecting proprietary prompt IP).
-- 4. Performance index on `generations(ip_address, created_at)` for hourly IP rate limiting.
-- ============================================================================

BEGIN;

-- 1. Atomic Credit & Metered Usage Consumption RPC (callable only via service_role)
CREATE OR REPLACE FUNCTION public.consume_generation_credit(
    p_profile_id uuid,
    p_overage_rate numeric,
    p_allowance integer DEFAULT 0,
    p_notification_state jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile record;
    v_jwt_role text;
    v_used_free boolean := false;
    v_used_discounted boolean := false;
    v_used_metered boolean := false;
    v_charge numeric := 0;
    v_effective_spend numeric := 0;
BEGIN
    v_jwt_role := COALESCE(
        current_setting('request.jwt.claim.role', true),
        (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
        ''
    );

    IF v_jwt_role IN ('anon', 'authenticated') THEN
        RAISE EXCEPTION 'Unauthorized: service_role required';
    END IF;

    SELECT *
    INTO v_profile
    FROM public.profiles
    WHERE id = p_profile_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Profile not found.');
    END IF;

    IF v_profile.subscription_status NOT IN ('active', 'trialing') THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Service Unavailable: The account associated with this tool is not currently active.');
    END IF;

    IF COALESCE(v_profile.free_credits_remaining, 0) > 0 THEN
        v_used_free := true;
        UPDATE public.profiles
        SET current_usage = COALESCE(current_usage, 0) + 1,
            free_credits_remaining = GREATEST(0, COALESCE(free_credits_remaining, 0) - 1),
            notification_state = COALESCE(p_notification_state, notification_state)
        WHERE id = p_profile_id;

    ELSIF COALESCE(v_profile.discounted_credits_remaining, 0) > 0 THEN
        v_used_discounted := true;
        v_charge := COALESCE(NULLIF(v_profile.discounted_rate, 0), p_overage_rate * 0.5);
        v_effective_spend := GREATEST(
            COALESCE(v_profile.pending_overage_balance, 0),
            (COALESCE(v_profile.current_overage_count, 0) * p_overage_rate) + COALESCE(v_profile.pending_discounted_amount, 0)
        );

        IF v_profile.max_monthly_spend IS NOT NULL AND v_profile.max_monthly_spend > 0 AND (v_effective_spend + v_charge) > v_profile.max_monthly_spend THEN
            RETURN jsonb_build_object('allowed', false, 'reason', format('Monthly spend limit ($%s) reached. Increase limit to continue.', v_profile.max_monthly_spend));
        END IF;

        UPDATE public.profiles
        SET current_usage = COALESCE(current_usage, 0) + 1,
            discounted_credits_remaining = GREATEST(0, COALESCE(discounted_credits_remaining, 0) - 1),
            pending_discounted_amount = ROUND((COALESCE(pending_discounted_amount, 0) + v_charge)::numeric, 2),
            pending_discounted_count = COALESCE(pending_discounted_count, 0) + 1,
            pending_overage_balance = ROUND((COALESCE(pending_overage_balance, 0) + v_charge)::numeric, 2),
            notification_state = COALESCE(p_notification_state, notification_state)
        WHERE id = p_profile_id;

    ELSIF COALESCE(v_profile.current_usage, 0) < COALESCE(p_allowance, 0) THEN
        UPDATE public.profiles
        SET current_usage = COALESCE(current_usage, 0) + 1,
            notification_state = COALESCE(p_notification_state, notification_state)
        WHERE id = p_profile_id;

    ELSE
        v_used_metered := true;
        v_charge := p_overage_rate;
        v_effective_spend := GREATEST(
            COALESCE(v_profile.pending_overage_balance, 0),
            (COALESCE(v_profile.current_overage_count, 0) * p_overage_rate) + COALESCE(v_profile.pending_discounted_amount, 0)
        );

        IF v_profile.max_monthly_spend IS NOT NULL AND v_profile.max_monthly_spend > 0 AND (v_effective_spend + v_charge) > v_profile.max_monthly_spend THEN
            RETURN jsonb_build_object('allowed', false, 'reason', format('Monthly spend limit ($%s) reached. Increase limit to continue.', v_profile.max_monthly_spend));
        END IF;

        UPDATE public.profiles
        SET current_usage = COALESCE(current_usage, 0) + 1,
            pending_overage_balance = ROUND((COALESCE(pending_overage_balance, 0) + v_charge)::numeric, 2),
            current_overage_count = COALESCE(current_overage_count, 0) + 1,
            notification_state = COALESCE(p_notification_state, notification_state)
        WHERE id = p_profile_id;
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'used_free', v_used_free,
        'used_discounted', v_used_discounted,
        'used_metered', v_used_metered,
        'charge', v_charge
    );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_generation_credit(uuid, numeric, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_generation_credit(uuid, numeric, integer, jsonb) TO service_role;

-- 2. Remove direct public/anon INSERT on `generations` (server inserts via service_role)
DROP POLICY IF EXISTS "Public can insert generations" ON public.generations;

-- 3. Index `generations(ip_address, created_at DESC)` for fast hourly rate-limit checks
CREATE INDEX IF NOT EXISTS idx_generations_ip_created_at
ON public.generations (ip_address, created_at DESC);

-- 4. Lock down `system_prompts` read access to platform super-admins only
DROP POLICY IF EXISTS "Allow public read of active prompts" ON public.system_prompts;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.system_prompts;
DROP POLICY IF EXISTS "Admins can read system_prompts" ON public.system_prompts;

CREATE POLICY "Admins can read system_prompts"
ON public.system_prompts
FOR SELECT
TO authenticated
USING (
    (SELECT auth.jwt() ->> 'email') IN (
        'admin@railify.com',
        'me@railify.com',
        'john@railify.com',
        'missmetalmagic@gmail.com',
        'mississippi_metal_magic@gmail.com'
    )
);

COMMIT;
