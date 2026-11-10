import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Note: Framing permissions are controlled dynamically via `Content-Security-Policy: frame-ancestors`
          // in `src/lib/supabase/middleware.ts` so authorized tenant domains can embed `/demo?org=<id>`.
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: "camera=*, microphone=(), geolocation=()", // Allow camera for visualizer photo capture
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload', // HSTS 2 Years
          }
        ],
      },
    ];
  },
};

export default nextConfig;
