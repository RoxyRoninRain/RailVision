-- Add pricing columns to portfolio table
ALTER TABLE portfolio 
ADD COLUMN IF NOT EXISTS price_per_ft_min numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_per_ft_max numeric DEFAULT 0;

-- Add location and travel settings to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS address_zip text,
ADD COLUMN IF NOT EXISTS travel_settings jsonb DEFAULT '{"pricing_type": "radius_tiers", "application_type": "flat", "tiers": []}'::jsonb;

-- Comment on columns
COMMENT ON COLUMN portfolio.price_per_ft_min IS 'Minimum price per linear foot for this style';
COMMENT ON COLUMN portfolio.price_per_ft_max IS 'Maximum price per linear foot for this style';
COMMENT ON COLUMN profiles.address_zip IS 'Zip code of the shop/tenant for distance calculations';
COMMENT ON COLUMN profiles.travel_settings IS 'Configuration for travel fees (radius tiers, per mile, etc)';
