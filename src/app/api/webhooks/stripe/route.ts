import { headers } from 'next/headers';
import type Stripe from 'stripe';
import { Resend } from 'resend';
import { WelcomeEmail } from '@/emails/WelcomeEmail';

// Force dynamic to prevent build-time static analysis execution attempts
export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY?.trim());

export async function POST(req: Request) {
    const { stripe } = await import('@/lib/stripe');
    const { supabase, adminSupabase } = await import('@/lib/supabase');

    const body = await req.text();
    const signature = (await headers()).get('Stripe-Signature') as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || '';

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            webhookSecret
        );
    } catch (error: any) {
        console.error(`Webhook Error: ${error.message}`);
        return new Response(`Webhook Error: ${error.message}`, { status: 400 });
    }

    // We need the admin client to bypass RLS for webhook updates
    // Assuming keys are set correctly in env
    const supabaseAdmin = adminSupabase || supabase;

    try {
        const session = event.data?.object as Stripe.Checkout.Session;
        const subscription = event.data?.object as Stripe.Subscription;

        switch (event.type) {
            case 'checkout.session.completed':
                // Retrieve the subscription details
                if (session.subscription) {
                    const subId = typeof session.subscription === 'string'
                        ? session.subscription
                        : session.subscription.id;

                    const sub = await stripe.subscriptions.retrieve(subId);

                    // Update user profile
                    const userId = session.metadata?.userId;
                    const tierName = session.metadata?.tierName;

                    if (userId) {
                        const updateData: any = {
                            stripe_subscription_id: sub.id,
                            stripe_customer_id: session.customer as string,
                            subscription_status: sub.status,
                        };

                        if (tierName) {
                            updateData.tier_name = tierName;
                        }

                        // Check if user has already received the first-time signup bonus
                        const { data: existingProfile } = await supabaseAdmin
                            .from('profiles')
                            .select('has_received_signup_bonus, free_credits_remaining')
                            .eq('id', userId)
                            .single();

                        if (!existingProfile?.has_received_signup_bonus) {
                            let bonusCredits = 0;
                            const normTier = (tierName || '').toLowerCase();
                            if (normTier.includes('volume')) {
                                bonusCredits = 50;
                            } else if (normTier.includes('pro')) {
                                bonusCredits = 25;
                            }

                            if (bonusCredits > 0) {
                                updateData.free_credits_remaining = (existingProfile?.free_credits_remaining || 0) + bonusCredits;
                                updateData.has_received_signup_bonus = true;
                                console.log(`[STRIPE WEBHOOK] Granted ${bonusCredits} free signup bonus credits to user ${userId}`);
                            }
                        }

                        await supabaseAdmin
                            .from('profiles')
                            .update(updateData)
                            .eq('id', userId);
                    }
                }

                // Send Welcome Email
                const customerEmail = session.customer_details?.email;
                const customerName = session.customer_details?.name || 'Customer';

                if (customerEmail) {
                    try {
                        await resend.emails.send({
                            from: 'Railify <onboarding@railify.app>',
                            to: customerEmail,
                            subject: 'Welcome to Railify - Important Next Steps',
                            react: WelcomeEmail({ name: customerName }),
                        });
                        console.log(`Welcome email sent to ${customerEmail}`);
                    } catch (emailError) {
                        console.error('Failed to send welcome email:', emailError);
                    }
                }
                break;

            case 'invoice.created': {
                const invoice = event.data.object as Stripe.Invoice;
                // Only attach accumulated monthly usage to subscription renewal/cycle invoices (not initial checkout or manual one-off invoices)
                const isInitialOrManual = invoice.billing_reason === 'subscription_create' || invoice.billing_reason === 'manual';
                if (invoice.customer && !isInitialOrManual) {
                    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id;

                    const { data: profile } = await supabaseAdmin
                        .from('profiles')
                        .select('id, tier_name, pending_overage_balance, current_overage_count, pending_discounted_amount, pending_discounted_count, discounted_rate')
                        .eq('stripe_customer_id', customerId)
                        .single();

                    if (profile) {
                        // 1. Attach Standard Overage Usage (if not already billed via a non-zero Stripe metered line item)
                        const pendingOverage = Number(profile.pending_overage_balance) || 0;
                        const hasMeteredChargeOnInvoice = (invoice.lines?.data || []).some(
                            (line: any) => line.price?.recurring?.usage_type === 'metered' && (line.amount || 0) > 0
                        );

                        if (pendingOverage > 0 && !hasMeteredChargeOnInvoice) {
                            const overageCents = Math.round(pendingOverage * 100);
                            const overageCount = Number(profile.current_overage_count) || 0;
                            const { PRICING_TIERS, DEFAULT_TIER } = await import('@/config/pricing');
                            const rawTier = String(profile.tier_name || DEFAULT_TIER).toLowerCase();
                            const matchedKey = (Object.keys(PRICING_TIERS) as Array<keyof typeof PRICING_TIERS>).find(
                                k => k.toLowerCase() === rawTier
                            ) || (rawTier.includes('volume') ? 'Volume' : rawTier.includes('pro') ? 'Professional' : DEFAULT_TIER);
                            const tierRate = (PRICING_TIERS[matchedKey] || PRICING_TIERS[DEFAULT_TIER]).overageRate.toFixed(2);

                            try {
                                await stripe.invoiceItems.create({
                                    customer: customerId,
                                    invoice: invoice.id,
                                    amount: overageCents,
                                    currency: 'usd',
                                    description: overageCount > 0
                                        ? `Metered Generation Usage: ${overageCount} designs @ $${tierRate}/each`
                                        : `Metered Generation Usage ($${(overageCents / 100).toFixed(2)})`,
                                }, {
                                    idempotencyKey: `overage_${invoice.id}_${profile.id}`
                                });
                                console.log(`[STRIPE WEBHOOK] Added $${(overageCents / 100).toFixed(2)} standard usage line item to invoice ${invoice.id}`);
                            } catch (overageErr) {
                                console.error('[STRIPE WEBHOOK] Failed to attach standard overage invoice item:', overageErr);
                            }
                        }

                        // 2. Attach Promotional Discounted Usage (50% rate)
                        if (Number(profile.pending_discounted_amount) > 0) {
                            const amountCents = Math.round(Number(profile.pending_discounted_amount) * 100);
                            const count = profile.pending_discounted_count || 0;
                            const rate = Number(profile.discounted_rate || 0).toFixed(2);

                            try {
                                await stripe.invoiceItems.create({
                                    customer: customerId,
                                    invoice: invoice.id,
                                    amount: amountCents,
                                    currency: 'usd',
                                    description: `Special Promotion: ${count} designs @ $${rate}/each`,
                                }, {
                                    idempotencyKey: `promo_${invoice.id}_${profile.id}`
                                });

                                console.log(`[STRIPE WEBHOOK] Added $${(amountCents / 100).toFixed(2)} discounted promo line item to invoice ${invoice.id}`);
                                // Note: Do NOT reset pending_discounted_amount or pending_overage_balance here;
                                // they are reset in invoice.payment_succeeded once payment is actually collected.
                            } catch (itemErr) {
                                console.error('[STRIPE WEBHOOK] Failed to attach promotional invoice item:', itemErr);
                            }
                        }
                    }
                }
                break;
            }

            case 'invoice.paid':
            case 'invoice.payment_succeeded':
                const invoice = event.data.object as Stripe.Invoice;
                // Handle successful payment (renewals or explicit overage settlements)
                // Cast to any to avoid "Property 'subscription' does not exist" if types are outdated
                const isSubscriptionOrOverageInvoice =
                    Boolean((invoice as any).subscription) ||
                    Boolean(invoice.billing_reason?.startsWith('subscription')) ||
                    invoice.metadata?.overage_settlement === 'true';

                if (isSubscriptionOrOverageInvoice && invoice.customer) {
                    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id;

                    // Sync status AND Reset Usage for the new period once payment succeeds
                    console.log(`[STRIPE WEBHOOK] Invoice paid for customer ${customerId}. Resetting usage.`);

                    await supabaseAdmin
                        .from('profiles')
                        .update({
                            subscription_status: 'active',
                            current_usage: 0,           // Reset monthly usage counter
                            pending_overage_balance: 0, // Reset local balance tracker
                            current_overage_count: 0,   // Reset local overage counter
                            pending_discounted_amount: 0,
                            pending_discounted_count: 0
                        })
                        .eq('stripe_customer_id', customerId);
                }
                break;

            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
                // Sync status
                if (subscription.id) {
                    // Fetch latest status
                    const status = subscription.status;
                    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

                    await supabaseAdmin
                        .from('profiles')
                        .update({
                            subscription_status: status
                        })
                        .eq('stripe_customer_id', customerId);
                }
                break;

            default:
                console.log(`Unhandled event type ${event.type}`);
        }
    } catch (err) {
        console.error('Error processing webhook:', err);
        // Return 200 to acknowledge receipt even if processing failed to avoid retries loops? 
        // Better to fail if it's a transient error.
        return new Response('Webhook handler failed', { status: 500 });
    }

    return new Response(null, { status: 200 });
}
