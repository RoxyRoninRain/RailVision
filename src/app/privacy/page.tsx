'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-primary/30 selection:text-white font-sans flex flex-col">
            <Navbar />

            <main className="flex-grow pt-32 pb-20 px-6">
                <div className="max-w-4xl mx-auto prose prose-invert prose-p:text-gray-400 prose-headings:text-white prose-a:text-primary">
                    <h1>Privacy Policy</h1>
                    <p className="text-sm text-gray-500">Last Updated: {new Date().toLocaleDateString()}</p>

                    <p>
                        Welcome to Railify ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy.
                        If you have any questions or concerns about this privacy notice, or our practices with regards to your personal information,
                        please contact us at railifyai@gmail.com.
                    </p>

                    <h2>1. Information We Collect</h2>
                    <p>
                        We collect personal information that you voluntarily provide to us when you express an interest in obtaining information about us or our products and services,
                        when you participate in activities on the Website, or otherwise when you contact us.
                    </p>
                    <ul>
                        <li><strong>Personal Data:</strong> Name, Email address, Phone number (optional).</li>
                        <li><strong>Uploads:</strong> Images of staircases or environments you upload for visualization purposes.</li>
                    </ul>

                    <h2>2. How We Use Your Information</h2>
                    <p>
                        We use personal information collected via our Website for a variety of business purposes described below. We process your personal information for these purposes in reliance on our legitimate business interests,
                        in order to enter into or perform a contract with you, with your consent, and/or for compliance with our legal obligations.
                    </p>
                    <ul>
                        <li>To facilitate account creation and logon process.</li>
                        <li>To send you marketing and promotional communications.</li>
                        <li>To fulfill and manage your orders/requests.</li>
                        <li>To improve our services and AI models.</li>
                    </ul>

                    <h2>3. Will Your Information be Shared with Anyone?</h2>
                    <p>
                        We only share information with your consent, to comply with laws, to provide you with services, to protect your rights, or to fulfill business obligations.
                    </p>

                    <h2>4. Storage of Data</h2>
                    <p>
                        We store your data securely using industry-standard cloud providers. We keep your information for as long as necessary to fulfill the purposes outlined in this privacy notice unless otherwise required by law.
                    </p>

                    <h2>5. Contact Us</h2>
                    <p>
                        If you have questions or comments about this policy, you may email us at railifyai@gmail.com.
                    </p>
                </div>
            </main>

            <Footer />
        </div>
    );
}
