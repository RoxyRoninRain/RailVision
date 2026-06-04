const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function syncWebhook() {
  try {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const targetUrl = 'https://railify.app/api/webhooks/stripe';
    let existingEndpoint = endpoints.data.find(e => e.url === targetUrl);

    const requiredEvents = [
        'checkout.session.completed',
        'invoice.payment_succeeded',
        'customer.subscription.updated',
        'customer.subscription.deleted',
    ];

    if (existingEndpoint) {
      console.log(`Found existing endpoint for ${targetUrl}. Updating events...`);
      const updated = await stripe.webhookEndpoints.update(existingEndpoint.id, {
        enabled_events: requiredEvents,
      });
      console.log('Successfully updated events!');
      console.log('Endpoint ID:', updated.id);
      console.log('Events enabled:', updated.enabled_events.join(', '));
      console.log('\nNOTE: Your STRIPE_WEBHOOK_SECRET remains the same: ' + process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      console.log(`No existing endpoint found for ${targetUrl}. Creating new one...`);
      const endpoint = await stripe.webhookEndpoints.create({
        url: targetUrl,
        enabled_events: requiredEvents,
      });
      console.log('Successfully created Stripe Webhook Endpoint!');
      console.log('Your NEW Webhook Secret is:', endpoint.secret);
      console.log('\nIMPORTANT: Please update STRIPE_WEBHOOK_SECRET in Vercel and your .env.local to match this new secret!');
    }
  } catch (error) {
    console.error('Error syncing webhook:', error.message);
  }
}

syncWebhook();
