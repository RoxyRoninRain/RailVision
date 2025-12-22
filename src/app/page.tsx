import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Check, Sparkles, Building2, Store, HandCoins, ChevronRight, Zap, ShieldCheck, Palette, Code2 } from 'lucide-react';
import PricingCarousel from '@/components/PricingCarousel';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden selection:bg-primary/30 selection:text-white font-sans">

      {/* --- NAVBAR --- */}
      <nav className="fixed top-0 left-0 w-full z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md">
        <div className="w-full bg-gradient-to-r from-green-400/90 to-green-500/90 text-black text-center py-1.5 text-xs font-bold tracking-widest uppercase">
          🚀 Launching Soon!
        </div>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative w-48 h-12">
              <Image
                src="/logo.png"
                alt="Railify Logo"
                fill
                className="object-contain object-left"
                priority
              />
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
            <Link href="#features" className="hover:text-white transition-colors">Features</Link>
            <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Log in</Link>
            <Link href="/signup" className="bg-white text-black px-4 py-2 rounded-full text-sm font-bold hover:bg-gray-200 transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

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
                <p className="text-gray-400 text-sm">Your logo, your colors, your domain. Removed "Powered by Railify" branding for Pro users.</p>
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

          <div className="bg-[#111] border border-white/10 rounded-2xl p-12 text-center max-w-3xl mx-auto relative overflow-hidden group">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

            <h3 className="text-3xl font-bold text-white mb-6 relative z-10">Metered Utility Pricing</h3>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto relative z-10">
              Pay for what you use. Plans start at just <strong>$49/mo</strong> with included allowances and Overdrive™ scalability.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
              <Link href="/pricing" className="px-8 py-4 bg-[var(--primary)] hover:bg-white text-black font-bold uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]">
                View All Plans
              </Link>
              <Link href="/signup" className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl transition-colors">
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-12 border-t border-white/5 bg-black text-gray-500 text-sm">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="relative w-32 h-10">
                <Image
                  src="/logo.png"
                  alt="Railify Logo"
                  fill
                  className="object-contain object-left"
                />
              </div>
            </div>
            <p>The #1 Handrail Visualization Platform.</p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Product</h4>
            <ul className="space-y-2">
              <li><Link href="#features" className="hover:text-primary">Features</Link></li>
              <li><Link href="#pricing" className="hover:text-primary">Pricing</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Resources</h4>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-primary">Documentation</a></li>
              <li><a href="#" className="hover:text-primary">API</a></li>
              <li><a href="#" className="hover:text-primary">Support</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Legal</h4>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-primary">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-primary">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-white/5 text-center">
          © {new Date().getFullYear()} Railify. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
