'use server';

import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server'; // Adjust import if you have a different supabase server client creator
import { PRICING_TIERS, TierName } from '@/config/pricing';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export async function createCheckoutSession(tierName: TierName) {
    const supabase = await createClient();

    // 1. Get User
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'User not logged in' };
    }

    // 2. Get Profile to check for existing Stripe Customer ID
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        // Removing full_name as it does not exist in the schema
        .select('stripe_customer_id, email, shop_name')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        console.error('Error fetching profile:', profileError);
        return { error: 'Could not fetch user profile' };
    }

    // Handle case-insensitivity and aliases like 'pro'
    const normalizedName = String(tierName).toLowerCase();
    const actualTierName = (Object.keys(PRICING_TIERS).find(k => k.toLowerCase() === normalizedName) || 
                           (normalizedName === 'pro' ? 'Professional' : null)) as TierName | null;

    if (!actualTierName) {
        console.error(`Pricing tier ${tierName} not found.`);
        return { error: `Pricing tier ${tierName} not found.` };
    }

    const tier = PRICING_TIERS[actualTierName];
    if (!tier || !tier.stripePriceId) {
        return { error: `Pricing tier ${actualTierName} configuration missing.` };
    }

    // 3. Get or Create Stripe Customer
    let customerId = profile.stripe_customer_id;

    if (!customerId) {
        const customerData: Stripe.CustomerCreateParams = {
            email: user.email || profile.email,
            metadata: {
                supabaseUUID: user.id,
            },
        };

        // Add name if we have it (using shop_name as proxy for name)
        if (profile.shop_name) {
            customerData.name = profile.shop_name;
        }

        const customer = await stripe.customers.create(customerData);

        customerId = customer.id;

        // Save to DB along with selected tier_name so billing rate is immediately accurate
        await supabase
            .from('profiles')
            .update({ stripe_customer_id: customerId, tier_name: actualTierName })
            .eq('id', user.id);
    } else {
        await supabase
            .from('profiles')
            .update({ tier_name: actualTierName })
            .eq('id', user.id);
    }

    // 4. Construct Line Items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
        {
            price: tier.stripePriceId,
            quantity: 1,
        },
    ];

    // Add Onboarding Fee if applicable and configured
    if (tier.stripeOnboardingPriceId && tier.onboardingFee > 0) {
        lineItems.push({
            price: tier.stripeOnboardingPriceId,
            quantity: 1,
        });
    }

    // Add Metered Price (Overage Tracker) if configured
    if (tier.stripeMeteredPriceId) {
        lineItems.push({
            price: tier.stripeMeteredPriceId,
            // For metered prices, we usually don't verify quantity 1, 
            // but Stripe requires us to subscribe to the price to start tracking.
        });
    }

    // 5. Create Checkout Session
    console.log('[STRIPE] Creating checkout session for user:', user.id);
    console.log('[STRIPE] Line Items:', JSON.stringify(lineItems, null, 2));

    // Ensure we have a valid base URL
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://railify.app';
    if (!baseUrl.startsWith('http')) {
        baseUrl = `https://${baseUrl}`;
    }
    console.log('[STRIPE] Using Success/Cancel Base URL:', baseUrl);

    let session;
    try {
        session = await stripe.checkout.sessions.create({
            customer: customerId,
            line_items: lineItems,
            mode: 'subscription',
            success_url: `${baseUrl}/onboarding?checkout=success`,
            cancel_url: `${baseUrl}/pricing?checkout=cancel`,
            subscription_data: {
                metadata: {
                    tierName: actualTierName,
                },
            },
            metadata: {
                userId: user.id,
                tierName: actualTierName
            },
            allow_promotion_codes: true, // Optional: allow promo codes
        });
    } catch (err: any) {
        console.error('[STRIPE] Checkout Session Creation Failed:', err);
        return { error: `Stripe Checkout Failed: ${err.message}` };
    }

    if (!session?.url) {
        return { error: 'Failed to create checkout session' };
    }

    return { url: session.url };
}

// Internal use only - called from ai.ts after generation
export async function reportUsage(userId: string, quantity: number = 1) {
    // Verify the calling context has a valid userId
    if (!userId) return;

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient() || await createClient();

    // 1. Get User's Subscription ID & Customer ID
    const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_subscription_id, stripe_customer_id')
        .eq('id', userId)
        .single();

    let subscriptionId = profile?.stripe_subscription_id;
    let subscription: Stripe.Subscription | null = null;

    if (subscriptionId) {
        try {
            subscription = await stripe.subscriptions.retrieve(subscriptionId);
        } catch (err: any) {
            console.warn(`Could not retrieve subscription ${subscriptionId}:`, err?.message);
        }
    }

    // Fallback: look up active subscription by stripe_customer_id and backfill stripe_subscription_id
    if (!subscription && profile?.stripe_customer_id) {
        try {
            const subList = await stripe.subscriptions.list({
                customer: profile.stripe_customer_id,
                status: 'active',
                limit: 1,
            });
            if (subList.data && subList.data.length > 0) {
                subscription = subList.data[0];
                subscriptionId = subscription.id;
                await supabase
                    .from('profiles')
                    .update({ stripe_subscription_id: subscriptionId })
                    .eq('id', userId);
            }
        } catch (err: any) {
            console.warn(`Could not list subscriptions for customer ${profile.stripe_customer_id}:`, err?.message);
        }
    }

    if (!subscription) {
        console.warn(`User ${userId} has no active Stripe subscription. Usage tracked in pending_overage_balance for monthly invoice.`);
        return;
    }

    // 2. Find item with recurring.usage_type = 'metered'
    const meteredItem = subscription.items.data.find(item => item.price.recurring?.usage_type === 'metered');

    if (!meteredItem) {
        console.warn(`Subscription ${subscription.id} has no metered item. Usage will be billed from pending_overage_balance on invoice.created.`);
        return;
    }

    // 3. Report Usage if legacy createUsageRecord is supported by the active Stripe SDK
    if (typeof (stripe.subscriptionItems as any).createUsageRecord === 'function') {
        const idempotencyKey = crypto.randomUUID();
        await (stripe.subscriptionItems as any).createUsageRecord(
            meteredItem.id,
            {
                quantity: quantity,
                timestamp: Math.floor(Date.now() / 1000),
                action: 'increment',
            },
            {
                idempotencyKey
            }
        );
    }
}
