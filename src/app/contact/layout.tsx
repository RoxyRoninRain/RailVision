import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Contact Us — Custom Handrail Visualizer & Enterprise Support',
    description:
        'Get in touch with the Railify team for enterprise plans, custom railing style calibration, website integration support, or general inquiries.',
    alternates: {
        canonical: 'https://railify.app/contact',
    },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
    return children;
}
