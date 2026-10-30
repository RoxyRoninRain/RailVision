import Stripe from 'stripe';

export const stripe = new Stripe((process.env.STRIPE_SECRET_KEY || '').trim(), {
    apiVersion: '2025-12-15.clover', // Update to match your Stripe package version
    typescript: true,
});
