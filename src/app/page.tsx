import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Check, Sparkles, Building2, Store, HandCoins, ChevronRight, Zap, ShieldCheck, Palette, Code2, HelpCircle } from 'lucide-react';
import PricingCarousel from '@/components/PricingCarousel';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Railify | AI Handrail & Stair Railing Visualizer + Instant Quote Estimator',
  description:
    'Embeddable white-label AI handrail and stair railing visualizer for custom metal fabricators, ornamental iron shops, and railing contractors. Let homeowners preview your railing styles on their own stairs and get an instant linear-foot quote.',
  alternates: {
    canonical: 'https://railify.app',
  },
};

const LANDING_FAQS = [
  {
    question: 'What is Railify and who is it built for?',
    answer:
      'Railify is a white-label AI handrail and stair railing visualizer paired with an instant linear-foot quote estimator. It is built specifically for custom metal fabricators, ornamental ironwork shops, welding businesses, stair builders, and deck or railing contractors who want to convert website visitors into pre-qualified leads.',
  },
  {
    question: 'How does the AI handrail visualizer work on a customer’s staircase photo?',
    answer:
      'Homeowners snap or upload a photo of their indoor staircase, front porch steps, or exterior deck directly on your website. They select one of your shop’s actual railing styles, and Railify’s architectural AI removes their old handrail and renders your exact design—honoring shoe rail vs. direct mount, top mount vs. fascia side mount, and weld details—while keeping their stairs, walls, and lighting intact.',
  },
  {
    question: 'How does Railify filter out tire-kickers and budget shoppers?',
    answer:
      'After seeing the photorealistic design on their stairs, customers can calculate an instant estimate using your per-linear-foot price range and automated ZIP-code travel distance fees. Prospects who cannot afford custom fabrication filter themselves out before calling you, so you only spend time on leads who already love the look and accept your pricing.',
  },
  {
    question: 'What do I receive when a customer submits a quote request?',
    answer:
      'You receive an instant email alert and a dashboard lead entry containing the customer’s name, email, phone number, project notes, estimated linear footage, price breakdown, and side-by-side Before (original staircase) and After (AI-generated railing) photos.',
  },
  {
    question: 'Can I embed Railify on WordPress, Wix, Squarespace, or a custom website?',
    answer:
      'Yes. Railify embeds on any website—including WordPress, Wix, Squarespace, Webflow, Shopify, GoDaddy, or custom HTML—using a single copy-and-paste responsive iframe snippet. On Professional and Volume plans, it is 100% white-labeled with your brand colors and automatic shop logo watermarks.',
  },
  {
    question: 'How much does Railify cost and can I cap my monthly spend?',
    answer:
      'Plans start at $20/month (Starter), $50/month (Professional with full white-labeling and 25 free signup credits), and $100/month (Volume with 50 free signup credits), plus a small metered per-render fee ($0.80–$1.20). You can set a hard Monthly Spend Safety Cap in your dashboard so your bill never exceeds your budget.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://railify.app/#organization',
      name: 'Railify',
      url: 'https://railify.app',
      logo: 'https://railify.app/logo.png',
      email: 'railifyai@gmail.com',
      description:
        'The #1 White-Label AI Handrail & Stair Railing Visualizer and Instant Quote Estimator for custom metal fabricators, ornamental iron shops, and railing contractors.',
    },
    {
      '@type': 'WebSite',
      '@id': 'https://railify.app/#website',
      url: 'https://railify.app',
      name: 'Railify',
      publisher: { '@id': 'https://railify.app/#organization' },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://railify.app/#software',
      name: 'Railify AI Handrail Visualizer',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Architectural Visualization & Quote Estimation Software',
      operatingSystem: 'Web, iOS, Android (Browser-based & Embeddable Widget)',
      url: 'https://railify.app',
      provider: { '@id': 'https://railify.app/#organization' },
      description:
        'Embeddable AI handrail and stair railing visualizer that lets homeowners preview a fabricator’s custom railing styles on a photo of their own stairs and calculate an instant linear-foot and travel-radius price estimate.',
      featureList: [
        'Photorealistic AI staircase and deck handrail visualization on customer photos',
        'Supports custom wrought iron, steel, aluminum, cable, glass, and wood-metal railing styles',
        'Fabrication-accurate rendering for Shoe Rail vs. Direct Mount and Top Mount vs. Side/Fascia Mount',
        'Instant linear-foot and ZIP-code travel radius price estimator',
        '100% White-Label website embed widget with automatic shop logo watermarking',
        'Automated Before & After photo lead capture and tire-kicker price filtering',
      ],
      offers: {
        '@type': 'AggregateOffer',
        lowPrice: '20.00',
        highPrice: '100.00',
        priceCurrency: 'USD',
        offerCount: 3,
        offers: [
          {
            '@type': 'Offer',
            name: 'Starter Plan',
            price: '20.00',
            priceCurrency: 'USD',
            description: '$20/mo base + $1.20 per AI render. Includes website embed, instant quote estimator, and lead dashboard.',
            url: 'https://railify.app/pricing',
          },
          {
            '@type': 'Offer',
            name: 'Professional Plan',
            price: '50.00',
            priceCurrency: 'USD',
            description: '$50/mo base + $1.00 per AI render. Includes 100% White-Label branding, custom logo watermark, and 25 Free Bonus Credits on signup.',
            url: 'https://railify.app/pricing',
          },
          {
            '@type': 'Offer',
            name: 'Volume Plan',
            price: '100.00',
            priceCurrency: 'USD',
            description: '$100/mo base + $0.80 per AI render. Includes 100% White-Label branding, priority support, and 50 Free Bonus Credits on signup.',
            url: 'https://railify.app/pricing',
          },
        ],
      },
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://railify.app/#faq',
      mainEntity: LANDING_FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    },
  ],
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden selection:bg-primary/30 selection:text-white font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* --- NAVBAR --- */}
      <Navbar />

      {/* --- HERO SECTION --- */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-secondary/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-primary mb-8 animate-fade-in-up">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            AI Handrail &amp; Stair Railing Visualizer · Plans start at $20/mo
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
            <span className="block text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50">Hook Them With Visuals.</span>
            <span className="block text-white">Filter Them With Price.</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            The white-label AI handrail visualizer and instant quote estimator for custom metal fabricators and railing contractors. Show homeowners your exact railing styles on their stairs, show them the cost upfront, and only hear from leads who love the design and can afford the bid.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2">
              Get Started <ChevronRight size={18} />
            </Link>
            <Link href="/pricing" className="w-full sm:w-auto px-8 py-4 text-gray-400 hover:text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2">
              View Pricing &amp; Plans
            </Link>
          </div>
        </div>
      </section>



      {/* --- LIVE DEMO EMBED SECTION --- */}
      <section className="py-20 px-6 bg-[#121212] border-y border-white/5">
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
      <section className="py-24 px-6 bg-[#0a0a0a] relative overflow-hidden">
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
                    <p className="text-gray-500 text-sm">Phone calls asking "how much?" Wasting hours driving to job sites and writing quotes, only to be ghosted because they couldn't afford you.</p>
                  </div>
                </div>
                <div className="w-full h-px bg-white/5" />
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Check className="text-green-400" size={24} />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white mb-1">With Railify</h4>
                    <p className="text-gray-400 text-sm">Tire-kickers see the price and filter themselves out. You only hear from leads who are hooked by the design and happy with the estimate.</p>
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
              <span className="text-white font-medium">This tool pays for itself even if you never close a single deal.</span> Why? Because it stops you from bleeding money on tire-kickers. The time and fuel you save by filtering out bad clients covers your bill instantly. The quality leads are just extra profit on top.
            </p>

            <ul className="space-y-4 mb-10">
              <li className="flex items-center gap-3 text-gray-300">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <Check size={14} className="text-primary" />
                </div>
                Customers see the design on their own home instantly
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <Check size={14} className="text-primary" />
                </div>
                Budget-shoppers filter themselves out before calling
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <Check size={14} className="text-primary" />
                </div>
                Every lead is already sold on the look and the price
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* --- FEATURES BENTO GRID --- */}
      <section id="features" className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Tools Built for the Modern Railing Shop</h2>
            <p className="text-xl text-gray-400 max-w-2xl">Make buying railings easy. Let homeowners see the transformation before they commit.</p>
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
                  <h3 className="text-2xl font-bold mb-2">Instant "Yes" Generator</h3>
                  <p className="text-gray-400">Customers don't understand 2D drawings. Show them a photo-realistic preview of your handrail on their stairs, and watch the hesitation disappear.</p>
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
                <h3 className="text-2xl font-bold mb-2">Your Brand, Your Reviews</h3>
                <p className="text-gray-400 text-sm">It looks 100% like your tool. Clients stay on your site, impressed by your technology. We stay invisible.</p>
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
                  <h3 className="text-2xl font-bold mb-2">The "Perfect Lead" Pipeline</h3>
                  <p className="text-gray-400">Stop digging through emails. Get a dashboard full of leads that have already chosen a style, seen the price, and uploaded site photos.</p>
                </div>
              </div>
            </div>

          </div>

          {/* Community Block */}
          <div className="mt-6 bg-gradient-to-r from-[#111] to-[#161616] border border-white/10 rounded-2xl p-8 text-center relative overflow-hidden group hover:border-white/20 transition-colors">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] opacity-5" />
            <div className="relative z-10 flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-4 text-white">
                <Store size={24} />
              </div>
              <h3 className="text-2xl font-bold mb-2">Shape The Future of Railify</h3>
              <p className="text-gray-400 max-w-2xl">Our roadmap is driven by our users. Join our community to request features and ensure the tool evolves to fit your shop perfectly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- HOW IT WORKS & FABRICATION ACCURACY SECTION --- */}
      <section className="py-24 px-6 bg-[#0d0d0d] border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">How Railify Works for Your Railing Shop</h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Purpose-built for custom metal fabricators, ornamental ironwork shops, welders, and stair builders.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#141414] border border-white/10 rounded-2xl p-8">
              <div className="text-xs font-mono uppercase tracking-widest text-primary mb-3">Step 01</div>
              <h3 className="text-xl font-bold mb-3">Homeowner Uploads Their Stairs</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Visitors on your website snap or upload a photo of their interior staircase, porch steps, or deck from any phone or computer—no app download required.
              </p>
            </div>

            <div className="bg-[#141414] border border-white/10 rounded-2xl p-8">
              <div className="text-xs font-mono uppercase tracking-widest text-primary mb-3">Step 02</div>
              <h3 className="text-xl font-bold mb-3">AI Renders Your Exact Fabrication Styles</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Our multi-pass architectural AI overlays your actual portfolio styles—honoring shoe rail vs. direct mount, top mount vs. side fascia mount, and weld details—directly onto their stairs.
              </p>
            </div>

            <div className="bg-[#141414] border border-white/10 rounded-2xl p-8">
              <div className="text-xs font-mono uppercase tracking-widest text-primary mb-3">Step 03</div>
              <h3 className="text-xl font-bold mb-3">Instant Quote Pre-Qualifies the Lead</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Customers enter their linear footage and ZIP code to see an instant estimate based on your per-foot rate and travel radius. You receive their Before &amp; After photos and contact info ready to close.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- PRICING SECTION --- */}
      <section id="pricing" className="py-24 px-6 bg-[#080808]">
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-400 mb-6">
            <ShieldCheck size={14} /> Stop losing money on free estimates
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-6">What Does One Wasted Trip Cost You?</h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Fuel, travel time, and hours quoting for a client who ghosts you. If Railify filters out just a few bad leads a month, it pays for itself.
          </p>

          <div className="mt-12">
            <PricingCarousel />
            <div className="mt-8 text-center">
              <p className="text-xs md:text-sm text-emerald-400 font-mono bg-emerald-500/10 inline-block px-4 py-2 rounded-full border border-emerald-500/20">
                🎁 Bonus Perk: Up to 50 Free Setup Credits included on first-time Pro &amp; Volume signups.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- FAQ SECTION (FOR USERS, SEARCH ENGINES & AI ASSISTANTS) --- */}
      <section id="faq" className="py-24 px-6 bg-[#0a0a0a] border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-gray-300 mb-4">
              <HelpCircle size={14} /> Frequently Asked Questions
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Everything Railing Shops Need to Know</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              How Railify helps custom metal fabricators, ornamental iron shops, and railing contractors win more bids in less time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {LANDING_FAQS.map((faq, idx) => (
              <div key={idx} className="bg-[#111] border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-2">{faq.question}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <Footer />
    </div>
  );
}
