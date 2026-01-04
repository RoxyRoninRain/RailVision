export type TierName = 'Starter' | 'Professional' | 'Volume' | 'The Unlimited';

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
    stripeOnboardingPriceId?: string; // Kept for type safety, though maybe unused in new model if no onboarding fee?
    stripeMeteredPriceId?: string;
}

export const PRICING_TIERS: Record<TierName, PricingTier> = {
    'Starter': {
        name: 'Starter',
        price: 20,
        allowance: 0,
        overageRate: 1.20,
        billingThreshold: 20,
        onboardingFee: 250,
        canEmbed: true,
        isWhiteLabel: false,
        features: ['Dashboard Access', 'Embed on your site', 'Powered by Railify Badge (Mandatory)'],
        stripePriceId: 'price_1SlwN6EJNh6NAPEX6ANPCBcO',
        stripeMeteredPriceId: 'price_1SlwN6EJNh6NAPEXnKMx5C9y',
        stripeOnboardingPriceId: 'price_1SlwT9EJNh6NAPEXR8z1dv1z'
    },
    'Professional': {
        name: 'Professional',
        price: 50,
        allowance: 0,
        overageRate: 1.00,
        billingThreshold: 50,
        onboardingFee: 250,
        canEmbed: true,
        isWhiteLabel: true,
        popular: true,
        features: ['White Label (No Badge)', 'Your Logo Watermark', 'Standard Processing'],
        stripePriceId: 'price_1SlwPmEJNh6NAPEXCudj7EDt',
        stripeMeteredPriceId: 'price_1SlwPmEJNh6NAPEXdoogs38P',
        stripeOnboardingPriceId: 'price_1SlwT9EJNh6NAPEXR8z1dv1z'
    },
    'Volume': {
        name: 'Volume',
        price: 100,
        allowance: 0,
        overageRate: 0.80,
        billingThreshold: 100,
        onboardingFee: 250,
        canEmbed: true,
        isWhiteLabel: true,
        features: ['White Label', 'Volume Discount', 'Priority Support'],
        stripePriceId: 'price_1SlwRiEJNh6NAPEXb1FsDlQy',
        stripeMeteredPriceId: 'price_1SlwRiEJNh6NAPEXANKMR94u',
        stripeOnboardingPriceId: 'price_1SlwT9EJNh6NAPEXR8z1dv1z'
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

export const DEFAULT_TIER: TierName = 'Starter';

