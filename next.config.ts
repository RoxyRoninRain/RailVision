import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self' https://vercel.live;",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vercel.live https://vercel.com;",
              "img-src 'self' blob: data: https://*.supabase.co https://assets.vercel.com;",
              "connect-src 'self' https://*.supabase.co https://*.googleapis.com https://vercel.live wss://ws-us3.pusher.com;",
              "style-src 'self' 'unsafe-inline';",
              "frame-src 'self' https://vercel.live;",
              "font-src 'self' data:;",
            ].join(' ').replace(/\s{2,}/g, ' ').trim()
          }
        ],
      },
    ];
  },
};

export default nextConfig;
