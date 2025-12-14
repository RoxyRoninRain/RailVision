import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                primary: {
                    DEFAULT: "var(--primary)",
                    foreground: "#ffffff",
                },
                secondary: {
                    DEFAULT: "var(--secondary)",
                    foreground: "#ffffff",
                },
                accent: {
                    DEFAULT: "var(--accent)",
                    foreground: "#ffffff",
                },
            },
            fontFamily: {
                mono: ["var(--font-mono)", "monospace"],
                sans: ["var(--font-geist-sans)", "Arial", "sans-serif"],
            },
        },
    },
    plugins: [],
};
export default config;
