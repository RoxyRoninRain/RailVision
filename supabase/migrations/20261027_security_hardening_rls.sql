-- ============================================================================
-- SECURITY HARDENING MIGRATION (2026-10-27)
-- 1. Prevent authenticated/anon users from tampering with billing, credit,
--    subscription, or Stripe fields on public.profiles via direct PostgREST calls.
-- 2. Restrict storage buckets to safe raster image MIME types (blocking HTML/SVG XSS).
-- 3. Align blocked_ips admin RLS policy with application admin list.
-- ============================================================================

BEGIN;

-- 1. Protect sensitive billing/subscription/credit columns on public.profiles
CREATE OR REPLACE FUNCTION public.enforce_profile_billing_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    jwt_role text;
BEGIN
    jwt_role := COALESCE(
        current_setting('request.jwt.claim.role', true),
        (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
        ''
    );

    -- Allow service_role and direct superuser/admin SQL connections to modify all columns
    IF jwt_role = 'service_role' OR current_user IN ('postgres', 'service_role', 'supabase_admin', 'supabase_auth_admin') THEN
        IF jwt_role NOT IN ('authenticated', 'anon') THEN
            RETURN NEW;
        END IF;
    END IF;

    -- For standard authenticated/anon PostgREST requests, lock down sensitive columns:
    IF TG_OP = 'INSERT' THEN
        NEW.subscription_status := 'incomplete';
        NEW.tier_name := COALESCE(NEW.tier_name, 'Starter');
        NEW.free_credits_remaining := 0;
        NEW.discounted_credits_remaining := 0;
        NEW.discounted_rate := 0;
        NEW.pending_overage_balance := 0;
        NEW.current_overage_count := 0;
        NEW.pending_discounted_amount := 0;
        NEW.pending_discounted_count := 0;
        NEW.current_usage := 0;
        NEW.stripe_customer_id := NULL;
        NEW.stripe_subscription_id := NULL;
        NEW.has_received_signup_bonus := FALSE;
    ELSIF TG_OP = 'UPDATE' THEN
        NEW.subscription_status := OLD.subscription_status;
        NEW.tier_name := OLD.tier_name;
        NEW.free_credits_remaining := OLD.free_credits_remaining;
        NEW.discounted_credits_remaining := OLD.discounted_credits_remaining;
        NEW.discounted_rate := OLD.discounted_rate;
        NEW.pending_overage_balance := OLD.pending_overage_balance;
        NEW.current_overage_count := OLD.current_overage_count;
        NEW.pending_discounted_amount := OLD.pending_discounted_amount;
        NEW.pending_discounted_count := OLD.pending_discounted_count;
        NEW.current_usage := OLD.current_usage;
        NEW.stripe_customer_id := OLD.stripe_customer_id;
        NEW.stripe_subscription_id := OLD.stripe_subscription_id;
        NEW.has_received_signup_bonus := OLD.has_received_signup_bonus;
        NEW.subscription_start_date := OLD.subscription_start_date;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_billing_security ON public.profiles;
CREATE TRIGGER trg_enforce_profile_billing_security
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_billing_security();

-- 2. Restrict public storage buckets to safe raster image MIME types (prevents SVG/HTML Stored XSS)
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    file_size_limit = 15728640 -- 15MB max per object
WHERE id IN ('quote-uploads', 'portfolio', 'logos');

-- 3. Align blocked_ips admin policy with application admin emails
DROP POLICY IF EXISTS "Admins can do everything on blocked_ips" ON public.blocked_ips;
CREATE POLICY "Admins can do everything on blocked_ips"
ON public.blocked_ips
FOR ALL
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
