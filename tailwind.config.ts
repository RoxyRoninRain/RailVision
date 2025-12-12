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
                    foreground: "#000000",
                },
                secondary: {
                    DEFAULT: "var(--secondary)",
                    foreground: "#ffffff",
                },
                accent: {
                    DEFAULT: "var(--accent)",
                    foreground: "#ffffff",
                },
                industrial: {
                    steel: "#2f2f2f",
                    gold: "#FFD700",
                    rust: "#FF4500",
                    dark: "#0a0a0a",
                }
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
