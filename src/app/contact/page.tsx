'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Mail, MessageSquare, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { submitContactForm } from '@/app/actions/contact';

export default function ContactPage() {
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    async function handleSubmit(formData: FormData) {
        setPending(true);
        setMessage(null);

        const result = await submitContactForm(formData);

        if (result.success) {
            setMessage({ type: 'success', text: 'Message sent successfully! We will get back to you soon.' });
            // Optional: Reset form here if needed, but standard HTML form submission behavior might differ.
            // Since we are using client component wrapping server action, we might need manual reset or just leave it.
            // For a top-tier UX, we'll reset the form by targeting the element if possible, or just show success state.
            (document.getElementById('contact-form') as HTMLFormElement)?.reset();
        } else {
            setMessage({ type: 'error', text: result.error || 'Something went wrong. Please try again.' });
        }
        setPending(false);
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-primary/30 selection:text-white font-sans flex flex-col">
            <Navbar />

            <main className="flex-grow pt-32 pb-20 px-6 relative overflow-hidden">
                {/* Background Gradients */}
                <div className="absolute top-0 left-1/4 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-[600px] h-[500px] bg-secondary/5 rounded-full blur-[120px] pointer-events-none" />

                <div className="max-w-4xl mx-auto relative z-10">
                    <div className="text-center mb-16">
                        <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
                            <span className="block text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50">Get in Touch</span>
                        </h1>
                        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                            Have questions about enterprise plans, integrations, or custom features? We're here to help.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-12">
                        {/* Contact Info Side */}
                        <div className="md:col-span-2 space-y-8">
                            <div className="bg-[#111] border border-white/10 rounded-2xl p-8">
                                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                    <Mail className="text-primary" size={20} />
                                    Contact Information
                                </h3>
                                <div className="space-y-4 text-gray-400">
                                    <p>
                                        <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Email</span>
                                        <a href="mailto:railifyai@gmail.com" className="text-white hover:text-primary transition-colors">railifyai@gmail.com</a>
                                    </p>
                                    <p>
                                        <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Support Hours</span>
                                        <span className="text-white">Mon-Fri, 9am - 5pm EST</span>
                                    </p>
                                </div>
                            </div>

                            <div className="bg-[#111] border border-white/10 rounded-2xl p-8">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <MessageSquare className="text-secondary" size={20} />
                                    FAQ
                                </h3>
                                <p className="text-sm text-gray-400 mb-4">
                                    Check our documentation for quick answers to common questions about installation and API usage.
                                </p>
                                <a href="#" className="text-sm font-medium text-white hover:underline decoration-primary">Read Documentation &rarr;</a>
                            </div>
                        </div>

                        {/* Form Side */}
                        <div className="md:col-span-3">
                            <form id="contact-form" action={handleSubmit} className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 md:p-10 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-primary/5 transition-all duration-700" />

                                <h3 className="text-2xl font-bold mb-8 relative z-10">Send us a message</h3>

                                <div className="space-y-6 relative z-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label htmlFor="name" className="text-sm font-medium text-gray-400">Name</label>
                                            <input
                                                type="text"
                                                name="name"
                                                id="name"
                                                required
                                                className="w-full bg-[#151515] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-gray-600"
                                                placeholder="John Doe"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label htmlFor="email" className="text-sm font-medium text-gray-400">Email</label>
                                            <input
                                                type="email"
                                                name="email"
                                                id="email"
                                                required
                                                className="w-full bg-[#151515] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-gray-600"
                                                placeholder="john@company.com"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label htmlFor="subject" className="text-sm font-medium text-gray-400">Subject</label>
                                        <input
                                            type="text"
                                            name="subject"
                                            id="subject"
                                            className="w-full bg-[#151515] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-gray-600"
                                            placeholder="How can we help?"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label htmlFor="message" className="text-sm font-medium text-gray-400">Message</label>
                                        <textarea
                                            name="message"
                                            id="message"
                                            required
                                            rows={5}
                                            className="w-full bg-[#151515] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-gray-600 resize-none"
                                            placeholder="Tell us about your project..."
                                        />
                                    </div>

                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={pending}
                                            className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {pending ? (
                                                <>
                                                    <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                                    Sending...
                                                </>
                                            ) : (
                                                <>
                                                    Send Message <Send size={18} />
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {message && (
                                        <div className={`p-4 rounded-lg flex items-center gap-3 text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'} animate-fade-in`}>
                                            {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                                            {message.text}
                                        </div>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
