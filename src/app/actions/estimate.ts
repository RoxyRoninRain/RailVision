'use server';

import { createClient } from '@/lib/supabase/server';
// @ts-ignore
import zipcodes from 'zipcodes';

interface TravelTier {
    radius: number;
    price: number;
}

interface TravelSettings {
    pricing_type: 'radius_tiers' | 'per_mile' | 'flat';
    application_type: 'flat' | 'per_foot_surcharge';
    tiers: TravelTier[];
    rate_per_mile?: number;
    base_fee?: number;
}

interface EstimateRequest {
    styleId: string;
    linearFeet: number;
    zipCode: string;
}

export async function calculateEstimate({ styleId, linearFeet, zipCode }: EstimateRequest) {
    const supabase = await createClient();

    // 1. Get Style Price
    const { data: style } = await supabase
        .from('portfolio')
        .select('price_per_ft_min, price_per_ft_max, tenant_id')
        .eq('id', styleId)
        .single();

    if (!style) {
        return { error: 'Style not found' };
    }

    const priceMin = style.price_per_ft_min || 0;
    const priceMax = style.price_per_ft_max || 0;

    // 2. Get Tenant Settings (Shop Zip & Travel)
    const { data: profile } = await supabase
        .from('profiles')
        .select('address_zip, travel_settings')
        .eq('id', style.tenant_id)
        .single();

    // Default or configured shop zip
    const shopZip = profile?.address_zip;

    let distance = 0;
    let travelFee = 0;

    // 3. Calculate Distance
    if (shopZip && zipCode) {
        // Use 'zipcodes' library
        const z1 = zipcodes.lookup(shopZip);
        const z2 = zipcodes.lookup(zipCode);

        if (z1 && z2) {
            distance = zipcodes.distance(z1.zip, z2.zip); // Returns miles by default
        }
    }

    // 4. Calculate Travel Fee
    const settings = profile?.travel_settings as TravelSettings | undefined;

    if (settings && distance > 0) {
        if (settings.pricing_type === 'radius_tiers' && settings.tiers) {
            // Find tier
            // Sort tiers by radius asc
            const sortedTiers = settings.tiers.sort((a, b) => a.radius - b.radius);
            for (const tier of sortedTiers) {
                if (distance <= tier.radius) {
                    travelFee = tier.price;
                    break;
                }
            }
            // If beyond last tier, maybe use last tier or custom? defaulting to last tier for now if defined
            if (travelFee === 0 && sortedTiers.length > 0 && distance > sortedTiers[sortedTiers.length - 1].radius) {
                // Or maybe it's not serviced?
                // For now, let's just cap at last tier or 0.
            }
        } else if (settings.pricing_type === 'per_mile') {
            travelFee = (settings.base_fee || 0) + (distance * (settings.rate_per_mile || 0));
        } else if (settings.pricing_type === 'flat') {
            travelFee = settings.base_fee || 0;
        }
    }

    // 5. Final Calculation

    let baseTotalMin = priceMin * linearFeet;
    let baseTotalMax = priceMax * linearFeet;

    let finalMin = baseTotalMin;
    let finalMax = baseTotalMax;

    // Apply Travel Fee
    if (settings?.application_type === 'per_foot_surcharge') {
        // Fee is added PER FOOT (unlikely for travel usually, but user mentioned options)
        // If it's a surcharge per foot, then travelFee is the value X.
        finalMin += (travelFee * linearFeet);
        finalMax += (travelFee * linearFeet);
    } else {
        // Flat addition
        finalMin += travelFee;
        finalMax += travelFee;
    }

    return {
        minPrice: finalMin,
        maxPrice: finalMax,
        distance,
        breakdown: {
            baseMin: baseTotalMin,
            baseMax: baseTotalMax,
            travelFee,
            pricePerFtMin: priceMin,
            pricePerFtMax: priceMax
        }
    };
}
