'use client';

import { useState, useEffect } from 'react';
import { getProfile, updateProfile } from '@/app/actions';
import { Copy, Check, Globe, Code2, Palette } from 'lucide-react';

export default function WidgetPage() {
    const [profile, setProfile] = useState<any>(null);
    const [website, setWebsite] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [embedHeight, setEmbedHeight] = useState('800');
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [primaryColor, setPrimaryColor] = useState('#FFD700');
    const [toolBackgroundColor, setToolBackgroundColor] = useState('#050505');

    useEffect(() => {
        getProfile().then(p => {
            if (p) {
                setProfile(p);
                setWebsite(p.website || '');
                setPrimaryColor(p.primary_color || '#FFD700');
                setToolBackgroundColor(p.tool_background_color || '#050505');
            }
            setLoading(false);
        });
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccess(null);

        const formData = new FormData();
        formData.append('website', website);
        formData.append('primary_color', primaryColor);
        formData.append('tool_background_color', toolBackgroundColor);

        try {
            const res = await updateProfile(formData);
            if (res.error) {
                // Friendly error for missing column
                if (res.error.includes('website')) {
                    setError("Database update needed: 'website' column missing.");
                } else {
                    setError(res.error);
                }
            } else {
                setSuccess("Domain verified successfully!");
                // Optimistic update
                setProfile((prev: any) => ({ ...prev, website }));
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const embedCode = `<iframe 
  src="https://railify.app/demo?org=${profile?.id || 'YOUR_ID'}" 
  width="100%" 
  height="${isFullScreen ? '100vh' : embedHeight}" 
  style="border:none; border-radius: 12px; background: transparent;"
  title="Design Studio"
  allow="web-share; clipboard-write"
></iframe>`;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(embedCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) return <div className="p-20 text-center text-gray-500 font-mono animate-pulse">LOADING...</div>;

    return (
        <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <div>
                <h1 className="text-4xl font-bold mb-2 tracking-tight text-white">Widget Integration</h1>
                <p className="text-gray-400">Manage your website embed settings and whitelisted domains.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* CONFIGURATION COLUMN */}
                <div className="space-y-6">
                    {/* Domain Card */}
                    <div className="bg-[#0A0A0A] border border-white/10 shadow-xl overflow-hidden rounded-xl relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[50px] pointer-events-none" />
                        <div className="p-6 border-b border-white/5">
                            <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                <div className="p-2 bg-primary/20 rounded-lg text-primary">
                                    <Globe size={20} />
                                </div>
                                Domain Whitelist
                            </h3>
                            <p className="text-gray-400 text-sm mt-1">
                                Enter the domain where you will embed the tool. This prevents unauthorized usage.
                            </p>
                        </div>
                        <div className="p-6 relative z-10">
                            <form onSubmit={handleSave} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-gray-300 block text-sm font-medium">Your Website URL</label>
                                    <input
                                        placeholder="https://your-shop-name.com"
                                        value={website}
                                        onChange={(e) => setWebsite(e.target.value)}
                                        className="w-full bg-[#111] border border-white/10 text-white focus:border-primary/50 text-lg py-3 px-4 rounded-lg outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-gray-600"
                                    />
                                    <p className="text-xs text-gray-500">
                                        Must match the domain in your browser address bar exactly (including https://).
                                    </p>
                                </div>

                                <div className="pt-4 border-t border-white/5 space-y-4">
                                    <h4 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                                        <Palette size={16} className="text-primary" /> Appearance
                                    </h4>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-gray-400 block text-xs font-mono uppercase tracking-wider mb-2">Brand Color</label>
                                            <div className="flex items-center gap-3 bg-[#111] p-2 rounded-lg border border-white/10">
                                                <input
                                                    type="color"
                                                    value={primaryColor}
                                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0"
                                                />
                                                <span className="text-sm text-gray-300 font-mono">{primaryColor}</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-gray-400 block text-xs font-mono uppercase tracking-wider mb-2">Background</label>
                                            <div className="flex items-center gap-3 bg-[#111] p-2 rounded-lg border border-white/10">
                                                <input
                                                    type="color"
                                                    value={toolBackgroundColor}
                                                    onChange={(e) => setToolBackgroundColor(e.target.value)}
                                                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0"
                                                />
                                                <span className="text-sm text-gray-300 font-mono">{toolBackgroundColor}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {error && (
                                    <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 text-sm">
                                        {error}
                                    </div>
                                )}
                                {success && (
                                    <div className="p-3 bg-green-900/20 border border-green-900/50 rounded-lg text-green-400 text-sm flex items-center gap-2">
                                        <Check size={14} /> {success}
                                    </div>
                                )}

                                <button
                                    disabled={saving}
                                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 text-lg rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                >
                                    {saving ? 'Verifying...' : 'Save & Activate'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Embed Code Card */}
                    <div className="bg-[#0A0A0A] border border-white/10 shadow-xl overflow-hidden rounded-xl">
                        <div className="p-6 border-b border-white/5">
                            <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                <div className="p-2 bg-secondary/20 rounded-lg text-secondary">
                                    <Code2 size={20} />
                                </div>
                                Embed Code
                            </h3>
                            <div className="flex items-center justify-between">
                                <p className="text-gray-400 text-sm mt-1">
                                    Copy and paste this code into your website's HTML.
                                </p>
                                {/* Height Toggles */}
                                <div className="flex bg-black/50 rounded-lg p-1 text-xs font-medium border border-white/10">
                                    <button
                                        onClick={() => setIsFullScreen(false)}
                                        className={`px-3 py-1 rounded-md transition-all ${!isFullScreen ? 'bg-secondary text-black' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Fixed Height
                                    </button>
                                    <button
                                        onClick={() => setIsFullScreen(true)}
                                        className={`px-3 py-1 rounded-md transition-all ${isFullScreen ? 'bg-secondary text-black' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Full Screen
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="relative group">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                <pre className="bg-[#111] p-6 rounded-xl text-sm text-gray-300 overflow-x-auto border border-white/10 font-mono leading-relaxed whitespace-pre-wrap">
                                    {embedCode}
                                </pre>
                                <button
                                    onClick={copyToClipboard}
                                    className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all active:scale-95 border border-white/5"
                                    title="Copy to clipboard"
                                >
                                    {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} className="text-gray-400" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* PREVIEW COLUMN */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white">Live Preview</h2>
                        <span className="text-xs uppercase tracking-wider text-gray-500 font-mono">Live Render</span>
                    </div>
                    <div className="bg-[#151515] rounded-2xl overflow-hidden border border-white/10 h-[600px] relative shadow-2xl">
                        {/* Checkered background for transparency check */}
                        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                        <iframe
                            src={`/demo?org=${profile?.id}`}
                            key={profile?.id} // Force reload on id load
                            className="w-full h-full border-none relative z-10"
                            title="Preview"
                        />
                    </div>
                    <p className="text-center text-sm text-gray-500">
                        This is exactly how the tool will appear on your site.
                    </p>
                </div>
            </div>
        </div>
    );
}
