import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Railify — AI Handrail & Stair Railing Visualizer',
        short_name: 'Railify',
        description:
            'White-label AI handrail and stair railing visualizer with instant linear-foot quote estimation for custom metal fabricators and railing contractors.',
        start_url: '/',
        display: 'standalone',
        background_color: '#050505',
        theme_color: '#FFD700',
        categories: ['business', 'productivity', 'design', 'utilities'],
        icons: [
            {
                src: '/logo.png',
                sizes: '512x512',
                type: 'image/png',
            },
        ],
    };
}
