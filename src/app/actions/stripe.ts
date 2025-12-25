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
        throw new Error('User not logged in');
    }

    // 2. Get Profile to check for existing Stripe Customer ID
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('stripe_customer_id, email, full_name') // Assuming these fields exist
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        console.error('Error fetching profile:', profileError);
        throw new Error('Could not fetch user profile');
    }

    const tier = PRICING_TIERS[tierName];
    if (!tier || !tier.stripePriceId) {
        throw new Error(`Pricing tier ${tierName} configuration missing.`);
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

        // Add name if we have it
        if (profile.full_name) {
            customerData.name = profile.full_name;
        }

        const customer = await stripe.customers.create(customerData);

        customerId = customer.id;

        // Save to DB
        await supabase
            .from('profiles')
            .update({ stripe_customer_id: customerId })
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
    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: lineItems,
        mode: 'subscription',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?checkout=cancel`,
        subscription_data: {
            metadata: {
                tierName: tierName,
            },
        },
        metadata: {
            userId: user.id,
            tierName: tierName
        },
        allow_promotion_codes: true, // Optional: allow promo codes
    });

    if (!session.url) {
        throw new Error('Failed to create checkout session');
    }

    redirect(session.url);
}

export async function reportUsage(userId: string, quantity: number = 1) {
    const supabase = await createClient(); // Use server client
    // Use admin client if we need to bypassing RLS for fetching sensitive profile data?
    // For now, assume authorized user action calling this.

    // 1. Get User's Subscription ID
    const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_subscription_id')
        .eq('id', userId)
        .single();

    if (!profile?.stripe_subscription_id) {
        console.warn(`User ${userId} has no active subscription. Usage not reported.`);
        return;
    }

    // 2. Fetch Subscription Items to find the Metered Item
    // We cache this in DB ideally, but for MVP we fetch from Stripe
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);

    // Find item with recurring.usage_type = 'metered'
    const meteredItem = subscription.items.data.find(item => item.price.recurring?.usage_type === 'metered');

    if (!meteredItem) {
        console.warn(`Subscription ${subscription.id} has no metered item.`);
        return;
    }

    // 3. Report Usage
    // Note: Stripe idempotency key is recommended.
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
