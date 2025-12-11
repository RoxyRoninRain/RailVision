import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self';",
              "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com;",
              "img-src 'self' blob: data: https://*.supabase.co;",
              "connect-src 'self' https://*.supabase.co https://*.googleapis.com;",
              "style-src 'self' 'unsafe-inline';",
            ].join(' ').replace(/\s{2,}/g, ' ').trim()
          }
        ],
      },
    ];
  },
};

export default nextConfig;
