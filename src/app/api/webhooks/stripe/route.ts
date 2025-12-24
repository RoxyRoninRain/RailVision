import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { supabase, adminSupabase } from '@/lib/supabase'; // Use admin client for DB updates

// Force dynamic to prevent build-time static analysis execution attempts
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const body = await req.text();
    const signature = (await headers()).get('Stripe-Signature') as string;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (error: any) {
        console.error(`Webhook Error: ${error.message}`);
        return new Response(`Webhook Error: ${error.message}`, { status: 400 });
    }

    // We need the admin client to bypass RLS for webhook updates
    // Assuming keys are set correctly in env
    const supabaseAdmin = adminSupabase || supabase;

    const session = event.data.object as Stripe.Checkout.Session;
    const subscription = event.data.object as Stripe.Subscription;

    try {
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
                    if (userId) {
                        await supabaseAdmin
                            .from('profiles')
                            .update({
                                stripe_subscription_id: sub.id,
                                stripe_customer_id: session.customer as string,
                                subscription_status: sub.status,
                            })
                            .eq('id', userId);
                    }
                }
                break;

            case 'invoice.payment_succeeded':
                // Handle successful payment (renewals)
                if (subscription.id && subscription.customer) {
                    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

                    // We might need to find the user by customer ID if metadata isn't on the invoice object
                    // Ideally we store customer ID in profile map
                    await supabaseAdmin
                        .from('profiles')
                        .update({
                            subscription_status: 'active'
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
