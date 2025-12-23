import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Check, Sparkles, Building2, Store, HandCoins, ChevronRight, Zap, ShieldCheck, Palette, Code2 } from 'lucide-react';
import PricingCarousel from '@/components/PricingCarousel';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden selection:bg-primary/30 selection:text-white font-sans">

      {/* --- NAVBAR --- */}
      <Navbar />

      {/* --- HERO SECTION --- */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-secondary/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-primary mb-8 animate-fade-in-up">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            New: SVG Watermark Support Available
          </div> */}

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
            <span className="block text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50">Close More Deals with</span>
            <span className="block text-white">Instant Visualization</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Empower your potential customers to visualize their dream handrails in real-time.
            Embed our white-label Design Studio directly on your website.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2">
              Get Started <ChevronRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* --- HOW IT WORKS SECTION --- */}
      <section className="py-24 px-6 bg-[#080808] border-b border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">From Photo to Quote in Minutes</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Streamline your sales process with our simple 3-step workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-[#111] border border-white/10 rounded-2xl p-8 relative group hover:border-primary/30 transition-colors">
              <div className="absolute -top-4 -left-4 w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-primary font-bold text-xl border border-primary/20 shadow-[0_0_20px_rgba(34,197,94,0.3)]">1</div>
              <div className="h-48 relative mb-6 rounded-lg overflow-hidden bg-black/50 border border-white/5 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                  <ArrowRight className="text-gray-600 rotate-[-45deg]" size={32} />
                </div>
                {/* Placeholder for UI graphic */}
              </div>
              <h3 className="text-xl font-bold mb-3">Upload User Photo</h3>
              <p className="text-gray-400 text-sm">Customer uploads a photo of their stairs directly to your site. Our AI instantly analyzes the geometry.</p>
            </div>

            {/* Step 2 */}
            <div className="bg-[#111] border border-white/10 rounded-2xl p-8 relative group hover:border-secondary/30 transition-colors">
              <div className="absolute -top-4 -left-4 w-12 h-12 bg-secondary/20 rounded-xl flex items-center justify-center text-secondary font-bold text-xl border border-secondary/20 shadow-[0_0_20px_rgba(59,130,246,0.3)]">2</div>
              <div className="h-48 relative mb-6 rounded-lg overflow-hidden bg-black/50 border border-white/5 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                  <Sparkles className="text-secondary" size={32} />
                </div>
              </div>
              <h3 className="text-xl font-bold mb-3">AI Visualization</h3>
              <p className="text-gray-400 text-sm">They select a style, and our AI renders a realistic preview of your handrail installed in their home.</p>
            </div>

            {/* Step 3 */}
            <div className="bg-[#111] border border-white/10 rounded-2xl p-8 relative group hover:border-orange-500/30 transition-colors">
              <div className="absolute -top-4 -left-4 w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center text-orange-400 font-bold text-xl border border-orange-500/20 shadow-[0_0_20px_rgba(249,115,22,0.3)]">3</div>
              <div className="h-48 relative mb-6 rounded-lg overflow-hidden bg-black/50 border border-white/5 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                  <HandCoins className="text-orange-400" size={32} />
                </div>
              </div>
              <h3 className="text-xl font-bold mb-3">Get the Lead</h3>
              <p className="text-gray-400 text-sm">To see the price or download the design, they enter their contact info. You get a qualified lead instantly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- LIVE DEMO EMBED SECTION --- */}
      <section className="py-20 px-6 bg-[#0a0a0a] border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Try It Right Here</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              This is exactly how the tool appears on your website. Fully interactive, mobile-responsive, and branded to you.
            </p>
          </div>

          <div className="relative w-full max-w-5xl mx-auto rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black h-[600px] max-h-[70vh]">
            {/* 
                Lead Tracking Enabled: Linked to Admin Tenant ID
            */}
            <iframe
              src="/demo?org=d899bbe8-10b5-4ee7-8ee5-5569e415178f"
              className="w-full h-full border-0"
              title="Railify Design Studio"
            />
          </div>
        </div>
      </section>

      {/* --- VALUE PROPOSITION SECTION --- */}
      <section className="py-24 px-6 bg-[#050505] relative overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 blur-[100px] rounded-full opacity-30" />
            <div className="relative bg-[#111] border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-red-400 font-bold text-xl">✕</span>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-300 mb-1">Before Railify</h4>
                    <p className="text-gray-500 text-sm">Endless emails answering "what will it look like?", driving to sites for tire-kickers, and chasing leads who can't afford you.</p>
                  </div>
                </div>
                <div className="w-full h-px bg-white/5" />
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Check className="text-green-400" size={24} />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white mb-1">With Railify</h4>
                    <p className="text-gray-400 text-sm">Automated design previews. Pricing estimates upfront. You only talk to customers who are designed, priced, and ready to buy.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-xs font-medium text-orange-400 mb-6">
              <Zap size={14} /> The Ultimate Sales Machine
            </div>
            <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Stop Wasting Time on <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-500">Tire Kickers</span>.
            </h2>
            <p className="text-xl text-gray-400 mb-8 leading-relaxed">
              Your time is expensive. Let our tool do the selling for you.
              <br /><br />
              <span className="text-white font-medium">Think about it:</span> One closed deal found through our automated lead filter pays for the software for the entire year. It's a no-brainer investment for your shop.
            </p>

            <ul className="space-y-4 mb-10">
              <li className="flex items-center gap-3 text-gray-300">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <Check size={14} className="text-primary" />
                </div>
                Filter out low-budget inquiries automatically
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <Check size={14} className="text-primary" />
                </div>
                Give customers the confidence to buy instantly
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <Check size={14} className="text-primary" />
                </div>
                24/7 Sales Agent on your website
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* --- FEATURES BENTO GRID --- */}
      <section id="features" className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Built for Metal Fabricators</h2>
            <p className="text-xl text-gray-400 max-w-2xl">Stop sending PDFs back and forth. Give your customers the power to design, while you control the specs.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[250px]">

            {/* Feature 1: Visualizer */}
            <div className="md:col-span-2 row-span-1 bg-[#111] border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-primary/50 transition-colors">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] group-hover:bg-primary/20 transition-all" />
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-primary mb-4">
                    <Sparkles size={24} />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">AI-Powered Visualization</h3>
                  <p className="text-gray-400">Customers upload a photo of their stairs, and our AI overlays your handrail designs instantly. No CAD required.</p>
                </div>
                <div className="flex items-center gap-2 text-primary font-medium">
                  Try it yourself <ArrowRight size={16} />
                </div>
              </div>
            </div>

            {/* Feature 2: White Label */}
            <div className="row-span-1 bg-[#111] border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-secondary/50 transition-colors">
              <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-secondary/10 to-transparent" />
              <div className="relative z-10">
                <div className="w-12 h-12 bg-secondary/20 rounded-xl flex items-center justify-center text-secondary mb-4">
                  <Building2 size={24} />
                </div>
                <h3 className="text-2xl font-bold mb-2">100% White Label</h3>
                <p className="text-gray-400 text-sm">Your logo, your colors, your domain. Removed &quot;Powered by Railify&quot; branding for Pro users.</p>
              </div>
            </div>

            {/* Feature 3: Embed */}
            <div className="row-span-1 bg-[#111] border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-accent/50 transition-colors">
              <div className="relative z-10">
                <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center text-accent mb-4">
                  <Code2 size={24} />
                </div>
                <h3 className="text-2xl font-bold mb-2">Embed Anywhere</h3>
                <p className="text-gray-400 text-sm">Copy-paste a simple iframe code snippet to add the Design Studio to your WordPress, Wix, or custom site.</p>
              </div>
            </div>

            {/* Feature 4: Lead Gen */}
            <div className="md:col-span-2 row-span-1 bg-[#111] border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-orange-500/50 transition-colors">
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-[80px]" />
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center text-orange-400 mb-4">
                    <HandCoins size={24} />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Capture High-Intent Leads</h3>
                  <p className="text-gray-400">Users must provide their contact info to download high-res designs or request a quote. Automatically piped to your dashboard.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- PRICING SECTION --- */}
      <section id="pricing" className="py-24 px-6 bg-[#080808]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Choose the plan that fits your business. From solo operators to industrial fabricators.
            </p>
          </div>

          <div className="mt-12">
            <PricingCarousel />
            <div className="mt-8 text-center animate-pulse">
              <p className="text-xs md:text-sm text-gray-500 font-mono bg-white/5 inline-block px-4 py-2 rounded-full border border-white/10">
                ⚠️ Note: Pricing subject to change. Lock in your price today.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <Footer />
    </div>
  );
}
