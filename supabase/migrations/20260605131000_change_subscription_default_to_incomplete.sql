-- Description: Change default subscription_status from active to incomplete to prevent unpaid access.

ALTER TABLE public.profiles ALTER COLUMN subscription_status SET DEFAULT 'incomplete';
