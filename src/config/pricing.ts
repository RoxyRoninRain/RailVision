
export const PRICING_TIERS = {
    SALESMATE: {
        id: 'salesmate',
        name: 'The Salesmate',
        price: 49,
        monthlyCredits: 50,
        allowRollover: false,
        maxStyleUploads: 5,
        features: {
            embedEnabled: false,
            whiteLabel: false,
            customWatermark: false,
            customBranding: false,
        },
        uiLabel: 'For Active Leads',
        cta: 'Get Started',
    },
    WIDGET: {
        id: 'widget',
        name: 'The Widget',
        price: 99,
        monthlyCredits: 100,
        allowRollover: false,
        maxStyleUploads: 5,
        features: {
            embedEnabled: true,
            whiteLabel: false,
            customWatermark: false,
            customBranding: true,
        },
        uiLabel: 'Website Lead Gen',
        cta: 'Upgrade to Widget',
    },
    SHOWROOM: {
        id: 'showroom',
        name: 'The Showroom',
        price: 300,
        monthlyCredits: 500,
        allowRollover: true,
        maxRollover: 1000,
        maxStyleUploads: 10,
        features: {
            embedEnabled: true,
            whiteLabel: true,
            customWatermark: true,
            customBranding: true,
        },
        uiLabel: 'The White-Glove Experience',
        cta: 'Go Pro',
    },
};

export const BOOSTER_PACKS = {
    REFILL: {
        id: 'refill',
        name: 'The Refill',
        credits: 50,
        price: 50,
        label: 'Standard',
    },
    PROJECT: {
        id: 'project',
        name: 'The Project Pack',
        credits: 150,
        price: 120,
        label: 'Save 20%',
    },
    STOCKPILE: {
        id: 'stockpile',
        name: 'The Stockpile',
        credits: 500,
        price: 350,
        label: 'Save 30%',
    },
};

export type TierId = keyof typeof PRICING_TIERS;
export type BoosterId = keyof typeof BOOSTER_PACKS;
