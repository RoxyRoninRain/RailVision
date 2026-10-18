import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://railify.app"),
  title: {
    default: "Railify | AI Handrail & Stair Railing Visualizer + Instant Quote Estimator",
    template: "%s | Railify",
  },
  description:
    "White-label AI handrail and stair railing visualizer with instant linear-foot price estimation. Built for custom metal fabricators, ornamental iron shops, welders, and railing contractors to convert homeowners and filter out tire-kickers.",
  keywords: [
    "AI handrail visualizer",
    "stair railing visualizer",
    "custom metal fabricator software",
    "handrail quote calculator",
    "railing cost estimator widget",
    "wrought iron railing visualizer",
    "deck railing visualizer",
    "white label railing design tool",
    "staircase renovation visualizer",
    "welding shop lead generation",
    "ornamental ironwork estimator",
    "cable railing visualizer",
    "Railify",
  ],
  authors: [{ name: "Railify", url: "https://railify.app" }],
  creator: "Railify",
  publisher: "Railify",
  category: "Construction & Fabrication Software",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://railify.app",
    siteName: "Railify",
    title: "Railify — AI Handrail & Stair Railing Visualizer for Custom Fabricators",
    description:
      "Let homeowners visualize your custom handrails on their own stairs in seconds and see an upfront price estimate. Filter out tire-kickers and close high-intent railing leads.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Railify — AI Handrail & Stair Railing Visualizer + Quote Estimator",
    description:
      "Hook homeowners with photorealistic AI stair railing previews and filter out tire-kickers with upfront linear-foot pricing. Embeds on any fabricator website.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
