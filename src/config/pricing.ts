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
        stripePriceId: 'price_1ShxQuCq2ZiMFYWGfAFXEFlJ',
        stripeOnboardingPriceId: 'price_1ShxQuCq2ZiMFYWGQu6cmxRb'
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
        stripePriceId: 'price_1ShxUxCq2ZiMFYWGZpBOgZ8s',
        stripeOnboardingPriceId: 'price_1ShxUxCq2ZiMFYWGy1WnHIVQ'
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
        stripePriceId: 'price_1ShxZYCq2ZiMFYWGbl4eh9um',
        stripeOnboardingPriceId: 'price_1ShxZYCq2ZiMFYWGXPiTvif0'
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
        stripePriceId: 'price_1ShxdICq2ZiMFYWGhfaxaqtY',
        stripeOnboardingPriceId: 'price_1ShxdICq2ZiMFYWGvBURRh21'
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
        stripePriceId: 'price_1ShxfwCq2ZiMFYWGl0j7GBVL'
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
