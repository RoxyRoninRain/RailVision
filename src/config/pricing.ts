export type TierName = 'The Estimator' | 'The Shop' | 'The Pro' | 'The Volume' | 'The Industrial';

export interface PricingTier {
    name: TierName;
    price: number;
    allowance: number;
    overageRate: number;
    canEmbed: boolean;
    isWhiteLabel: boolean;
    features: string[];
    popular?: boolean;
}

export const PRICING_TIERS: Record<TierName, PricingTier> = {
    'The Estimator': {
        name: 'The Estimator',
        price: 49,
        allowance: 50,
        overageRate: 1.00,
        canEmbed: false,
        isWhiteLabel: false,
        features: ['Dashboard Access Only', 'Standard Processing']
    },
    'The Shop': {
        name: 'The Shop',
        price: 99,
        allowance: 100,
        overageRate: 1.00,
        canEmbed: true,
        isWhiteLabel: false,
        features: ['Embed on your site', 'Powered by Railify Badge', 'Standard Processing']
    },
    'The Pro': {
        name: 'The Pro',
        price: 299,
        allowance: 400,
        overageRate: 0.90,
        canEmbed: true,
        isWhiteLabel: true,
        popular: true,
        features: ['Embed on your site', 'Your Logo Watermark', 'Standard Processing']
    },
    'The Volume': {
        name: 'The Volume',
        price: 500,
        allowance: 700,
        overageRate: 0.80,
        canEmbed: true,
        isWhiteLabel: true,
        features: ['Embed on your site', 'Your Logo Watermark', 'Priority Processing']
    },
    'The Industrial': {
        name: 'The Industrial',
        price: 750,
        allowance: 1000,
        overageRate: 0.75,
        canEmbed: true,
        isWhiteLabel: true,
        features: ['Embed on your site', 'Your Logo Watermark', 'Dedicated Support', 'Priority Processing']
    }
};

export const DEFAULT_TIER: TierName = 'The Estimator';
