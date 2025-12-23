'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-primary/30 selection:text-white font-sans flex flex-col">
            <Navbar />

            <main className="flex-grow pt-32 pb-20 px-6">
                <div className="max-w-4xl mx-auto prose prose-invert prose-p:text-gray-400 prose-headings:text-white prose-a:text-primary">
                    <h1>Terms of Service</h1>
                    <p className="text-sm text-gray-500">Last Updated: {new Date().toLocaleDateString()}</p>

                    <h2>1. Agreement to Terms</h2>
                    <p>
                        These Terms of Service constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you") and Railify ("we," "us", or "our"),
                        concerning your access to and use of the Railify website as well as any other media form, media channel, mobile website or mobile application related, linked, or otherwise connected thereto (collectively, the "Site").
                    </p>

                    <h2>2. Intellectual Property Rights</h2>
                    <p>
                        Unless otherwise indicated, the Site and the AI-generated visualizations are our proprietary property and all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics on the Site
                        (collectively, the "Content") and the trademarks, service marks, and logos contained therein (the "Marks") are owned or controlled by us or licensed to us.
                    </p>

                    <h2>3. User Representations</h2>
                    <p>
                        By using the Site, you represent and warrant that: (1) all registration information you submit will be true, accurate, current, and complete;
                        (2) you will maintain the accuracy of such information and promptly update such registration information as necessary.
                    </p>

                    <h2>4. Prohibited Activities</h2>
                    <p>
                        You may not access or use the Site for any purpose other than that for which we make the Site available. The Site may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us.
                    </p>

                    <h2>5. Limitation of Liability</h2>
                    <p>
                        In no event will we or our directors, employees, or agents be liable to you or any third party for any direct, indirect, consequential, exemplary, incidental, special, or punitive damages,
                        including lost profit, lost revenue, loss of data, or other damages arising from your use of the site, even if we have been advised of the possibility of such damages.
                    </p>

                    <h2>6. Contact Us</h2>
                    <p>
                        In order to resolve a complaint regarding the Site or to receive further information regarding use of the Site, please contact us at: railifyai@gmail.com
                    </p>
                </div>
            </main>

            <Footer />
        </div>
    );
}
