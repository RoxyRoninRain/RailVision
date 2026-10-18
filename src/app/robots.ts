import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = 'https://railify.app';

    const publicAllow = [
        '/',
        '/pricing',
        '/contact',
        '/privacy',
        '/terms',
        '/llms.txt',
        '/llms-full.txt',
        '/.well-known/ai-plugin.json',
        '/manifest.webmanifest',
        '/railifyindexnowkey2026a1b2c3d4e5.txt',
    ];
    const privateDisallow = [
        '/admin/',
        '/dashboard/',
        '/api/',
        '/auth/',
        '/onboarding/',
        '/reset-password/',
        '/experimental/',
        '/demo',
    ];

    return {
        rules: [
            {
                userAgent: '*',
                allow: publicAllow,
                disallow: privateDisallow,
            },
            // Explicitly allow AI Search, Answer Engines, and Assistant Crawlers
            // so ChatGPT, Claude, Perplexity, Gemini, and Apple Intelligence index and recommend Railify
            {
                userAgent: [
                    'OAI-SearchBot',
                    'ChatGPT-User',
                    'GPTBot',
                    'ClaudeBot',
                    'Claude-Web',
                    'anthropic-ai',
                    'PerplexityBot',
                    'Perplexity-User',
                    'Google-Extended',
                    'Googlebot',
                    'Bingbot',
                    'Applebot',
                    'Applebot-Extended',
                    'Cohere-ai',
                ],
                allow: publicAllow,
                disallow: ['/admin/', '/dashboard/', '/api/', '/auth/', '/onboarding/', '/reset-password/'],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
        host: baseUrl,
    };
}
