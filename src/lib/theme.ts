// Theme Constants
// Central source of truth for design tokens used in JS/Canvas logic

export const THEME = {
    colors: {
        primary: '#7C3AED',   // Violet-600
        secondary: '#4338CA', // Indigo-700
        accent: '#A855F7',    // Purple-500
        background: '#0a0a0a',
        foreground: '#ededed',

        // Semantic
        success: '#22c55e',   // Green-500
        error: '#ef4444',     // Red-500
        warning: '#f59e0b',   // Amber-500
    },
    fonts: {
        sans: 'var(--font-geist-sans)',
        mono: 'var(--font-mono)',
    }
} as const;
