export type TierName = 'The Estimator' | 'The Shop' | 'The Pro' | 'The Volume' | 'The Industrial' | 'The Unlimited';

export interface PricingTier {
    name: TierName;
    price: number;
    allowance: number;
    overageRate: number;
    billingThreshold: number;
    onboardingFee: number;
    canEmbed: boolean;
    isWhiteLabel: boolean;
    features: string[];
    popular?: boolean;
    stripePriceId?: string;
    stripeOnboardingPriceId?: string;
    stripeMeteredPriceId?: string;
}

export const PRICING_TIERS: Record<TierName, PricingTier> = {
    'The Estimator': {
        name: 'The Estimator',
        price: 49,
        allowance: 50,
        overageRate: 1.00,
        billingThreshold: 50,
        onboardingFee: 299,
        canEmbed: false,
        isWhiteLabel: false,
        features: ['Dashboard Access Only', 'Standard Processing'],
        stripePriceId: 'price_1Si37QEJNh6NAPEX9hQtVCAH',
        stripeOnboardingPriceId: 'price_1Si37QEJNh6NAPEXqosKo482',
        stripeMeteredPriceId: 'price_1Si3UKEJNh6NAPEXPesKmVsW'
    },
    'The Shop': {
        name: 'The Shop',
        price: 99,
        allowance: 100,
        overageRate: 1.00,
        billingThreshold: 100,
        onboardingFee: 299,
        canEmbed: true,
        isWhiteLabel: false,
        features: ['Embed on your site', 'Powered by Railify Badge', 'Standard Processing'],
        stripePriceId: 'price_1Si3B5EJNh6NAPEXrPkcLG6p',
        stripeOnboardingPriceId: 'price_1Si3B5EJNh6NAPEXB7YDphCE',
        stripeMeteredPriceId: 'price_1Si3TrEJNh6NAPEXwx8g4R5V'
    },
    'The Pro': {
        name: 'The Pro',
        price: 299,
        allowance: 400,
        overageRate: 0.90,
        billingThreshold: 400,
        onboardingFee: 249,
        canEmbed: true,
        isWhiteLabel: true,
        popular: true,
        features: ['Embed on your site', 'Your Logo Watermark', 'Standard Processing'],
        stripePriceId: 'price_1Si3CtEJNh6NAPEXkl4D5OiW',
        stripeOnboardingPriceId: 'price_1Si3CtEJNh6NAPEXdDM5TLiS',
        stripeMeteredPriceId: 'price_1Si3TFEJNh6NAPEXJ2url4ce'
    },
    'The Volume': {
        name: 'The Volume',
        price: 499,
        allowance: 700,
        overageRate: 0.80,
        billingThreshold: 700,
        onboardingFee: 149,
        canEmbed: true,
        isWhiteLabel: true,
        features: ['Embed on your site', 'Your Logo Watermark', 'Priority Processing'],
        stripePriceId: 'price_1Si3PLEJNh6NAPEXJ8WVTNE3',
        stripeOnboardingPriceId: 'price_1Si3PLEJNh6NAPEXryKTBmdp',
        stripeMeteredPriceId: 'price_1Si3PLEJNh6NAPEXnlbAf0id'
    },
    'The Industrial': {
        name: 'The Industrial',
        price: 749,
        allowance: 1000,
        overageRate: 0.75,
        billingThreshold: 1000,
        onboardingFee: 0,
        canEmbed: true,
        isWhiteLabel: true,
        features: ['Embed on your site', 'Your Logo Watermark', 'Dedicated Support', 'Priority Processing'],
        stripePriceId: 'price_1Si3EfEJNh6NAPEXSAqHORxt',
        stripeMeteredPriceId: 'price_1Si3SMEJNh6NAPEXKRyMif8W'
    },
    'The Unlimited': {
        name: 'The Unlimited',
        price: 0,
        allowance: 0,
        overageRate: 0.16,
        billingThreshold: 100,
        onboardingFee: 0,
        canEmbed: true,
        isWhiteLabel: true,
        features: ['Embed on your site', 'Your Logo Watermark', 'Dedicated Support', 'Priority Processing']
    }
};

export const DEFAULT_TIER: TierName = 'The Estimator';
