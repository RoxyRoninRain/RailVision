const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function checkErrors() {
  try {
    console.log("Checking recent Stripe activity for errors...\n");
    
    // Check recent events for payment failures
    const events = await stripe.events.list({ limit: 50 });
    let failedPayments = 0;
    
    console.log("--- Recent Failed Payments ---");
    for (const event of events.data) {
        if (event.type === 'payment_intent.payment_failed') {
            const errorMsg = event.data.object.last_payment_error?.message || 'Unknown error';
            console.log(`- [${new Date(event.created * 1000).toLocaleString()}] ${errorMsg}`);
            failedPayments++;
        }
    }
    
    if (failedPayments === 0) {
        console.log("No failed payments found in the last 50 events.");
    }

    console.log("\n--- Recent Checkout Sessions ---");
    const sessions = await stripe.checkout.sessions.list({ limit: 10 });
    for(const session of sessions.data) {
        console.log(`- [${new Date(session.created * 1000).toLocaleString()}] Status: ${session.status}, Payment Status: ${session.payment_status}`);
    }

  } catch (error) {
    console.error('Error fetching data from Stripe:', error.message);
  }
}

checkErrors();
