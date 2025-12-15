'use client';

import { useState, useEffect, useRef } from 'react';
import { getProfile, updateProfile, uploadLogo, purchaseBooster, toggleAutoBoost, Profile } from '@/app/actions';
import { Save, Upload, Building, Phone, MapPin, Mail, CreditCard, ShieldCheck, Image as ImageIcon, Zap, Coins } from 'lucide-react';
import { PRICING_TIERS, BOOSTER_PACKS } from '@/config/pricing';
import Image from 'next/image';

export default function SettingsPage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingWatermark, setUploadingWatermark] = useState(false);
    const [message, setMessage] = useState('');
    const watermarkInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        getProfile().then(data => {
            if (data) setProfile(data);
            setLoading(false);
        });
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');

        const formData = new FormData(e.currentTarget);
        const res = await updateProfile(formData);

        if (res.success) {
            setMessage('Profile updated successfully!');
            // Reflect updates locally
            if (profile) {
                setProfile({
                    ...profile,
                    shop_name: formData.get('shop_name') as string,
                    phone: formData.get('phone') as string,
                    address: formData.get('address') as string,
                    primary_color: formData.get('primary_color') as string,
                    tool_background_color: formData.get('tool_background_color') as string,
                });
            }
        } else {
            setMessage('Error updating profile: ' + res.error);
        }
        setSaving(false);
    };

    const handleBuyBooster = async (packId: string) => {
        if (!confirm('Simulate purchasing this booster pack?')) return;
        setSaving(true);
        const res = await purchaseBooster(packId);
        if (res.success) {
            setMessage('Booster pack purchased! Credits added.');
            // Refresh
            const updated = await getProfile();
            if (updated) setProfile(updated);
        } else {
            setMessage('Error: ' + res.error);
        }
        setSaving(false);
    };

    const handleToggleAutoBoost = async (checked: boolean) => {
        const res = await toggleAutoBoost(checked, checked ? 'REFILL' : undefined); // Default to Refill
        if (res.success) {
            if (profile) setProfile({ ...profile, auto_boost_enabled: checked, auto_boost_pack: checked ? 'REFILL' : profile.auto_boost_pack });
        }
    };



    const handleWatermarkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingWatermark(true);
        const formData = new FormData();
        formData.append('file', file);

        // We use the same uploadLogo action as it puts files in 'logos' bucket
        // Ideally we'd have uploadWatermark but reuse is fine if path logic is same
        const res = await uploadLogo(formData);

        if (res.success && res.url && profile) {
            setProfile({ ...profile, watermark_logo_url: res.url });
            setMessage('Watermark uploaded successfully!');
        } else {
            setMessage('Error uploading watermark: ' + (res.error || 'Unknown error'));
        }
        setUploadingWatermark(false);
    };

    if (loading) return <div className="p-8 text-white font-mono animate-pulse">Loading command center...</div>;

    return (
        <div className="min-h-screen bg-[#0a0a0a] p-6 md:p-12 text-white font-sans">
            <div className="max-w-5xl mx-auto">
                <header className="mb-12 border-b border-gray-800 pb-6">
                    <h1 className="text-4xl font-bold font-mono text-[var(--primary)] uppercase tracking-tighter mb-2">
                        Shop Command Center
                    </h1>
                    <p className="text-gray-500 text-lg">Manage your commercial profile and branding.</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Branding & quick status - MODIFIED: Removed Main Logo Card */}
                    <div className="space-y-8">

                        {/* Watermark Logo Card */}
                        <div className="bg-[#111] p-6 rounded-lg border border-gray-800 shadow-2xl relative overflow-hidden group">
                            <h2 className="text-xl font-mono font-bold text-white mb-6 flex items-center gap-2">
                                <ImageIcon className="text-gray-400" size={20} />
                                Watermark Logo
                            </h2>

                            <div className="flex flex-col items-center justify-center p-6 bg-black/50 rounded-lg border border-dashed border-gray-700 hover:border-gray-500 transition-colors relative">
                                <div className="w-32 h-32 relative mb-4 rounded overflow-hidden bg-gray-900 border-2 border-gray-800 flex items-center justify-center group-hover:border-[var(--primary)] transition-colors">
                                    {profile?.watermark_logo_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={profile.watermark_logo_url}
                                            alt="Watermark Logo"
                                            className="w-full h-full object-contain p-2"
                                        />
                                    ) : (
                                        <ShieldCheck className="text-gray-600" size={48} />
                                    )}
                                    {uploadingWatermark && (
                                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[var(--primary)]"></div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => watermarkInputRef.current?.click()}
                                    disabled={uploadingWatermark}
                                    className="text-sm text-gray-400 font-mono uppercase hover:text-white hover:underline cursor-pointer"
                                >
                                    {profile?.watermark_logo_url ? 'Replace Watermark' : 'Upload Watermark'}
                                </button>
                                <input
                                    ref={watermarkInputRef}
                                    type="file"
                                    accept="image/png, image/jpeg, image/svg+xml, .svg"
                                    className="hidden"
                                    onChange={handleWatermarkUpload}
                                />
                                <p className="text-xs text-gray-600 mt-2 text-center">
                                    Used for image overlays.<br />PNG/SVG with transparency best.
                                </p>
                            </div>
                        </div>

                        {/* Subscription Status */}
                        <div className="bg-[#111] p-6 rounded-lg border border-gray-800 shadow-xl relative">
                            <h2 className="text-xl font-mono font-bold text-white mb-4 flex items-center gap-2">
                                <CreditCard className="text-gray-400" size={20} />
                                Subscription
                            </h2>
                            <div className="flex items-center justify-between bg-black/40 p-4 rounded border border-gray-800">
                                <span className="text-gray-400 font-mono text-sm uppercase">Status</span>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${profile?.subscription_status === 'active' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                                    <span className="capitalize font-bold text-white">{profile?.subscription_status}</span>
                                </div>
                            </div>
                            <div className="mt-4 text-center">
                                <button className="text-sm text-gray-500 hover:text-white transition-colors underline decoration-dotted">
                                    Manage Billing Portal
                                </button>
                            </div>
                        </div>

                        {/* Credits Status */}
                        <div className="bg-[#111] p-6 rounded-lg border border-gray-800 shadow-xl relative mt-8">
                            <h2 className="text-xl font-mono font-bold text-white mb-4 flex items-center gap-2">
                                <Coins className="text-[var(--primary)]" size={20} />
                                Credits
                            </h2>

                            <div className="grid grid-cols-2 gap-2 mb-4">
                                <div className="bg-black/40 p-3 rounded border border-gray-800">
                                    <div className="text-xs text-gray-500 uppercase font-mono">Monthly</div>
                                    <div className="text-xl font-bold">{profile?.credits_monthly ?? 0}</div>
                                </div>
                                <div className="bg-black/40 p-3 rounded border border-gray-800">
                                    <div className="text-xs text-gray-500 uppercase font-mono">Booster</div>
                                    <div className="text-xl font-bold">{profile?.credits_booster ?? 0}</div>
                                </div>
                                {profile?.tier === 'showroom' && (
                                    <div className="bg-black/40 p-3 rounded border border-gray-800 col-span-2">
                                        <div className="text-xs text-gray-500 uppercase font-mono">Rollover</div>
                                        <div className="text-xl font-bold">{profile?.credits_rollover ?? 0}</div>
                                    </div>
                                )}
                            </div>

                            <div className="mb-6">
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400 select-none">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={profile?.auto_boost_enabled || false}
                                            onChange={(e) => handleToggleAutoBoost(e.target.checked)}
                                        />
                                        <div className="w-10 h-6 bg-gray-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]"></div>
                                    </div>
                                    Auto-Boost (when &lt; 10)
                                </label>
                            </div>

                            <h3 className="text-sm font-mono text-gray-500 mb-3 border-b border-gray-800 pb-1">Refill Boosters</h3>
                            <div className="space-y-2">
                                {Object.values(BOOSTER_PACKS).map((pack) => (
                                    <button
                                        key={pack.id}
                                        onClick={() => handleBuyBooster(pack.id)}
                                        disabled={saving}
                                        className="w-full flex items-center justify-between p-3 rounded bg-black/60 hover:bg-[var(--primary)] hover:text-black border border-white/5 transition-all group text-left"
                                    >
                                        <div>
                                            <div className="font-bold text-sm">{pack.name}</div>
                                            <div className="text-xs text-gray-500 group-hover:text-black/70">{pack.credits} Credits</div>
                                        </div>
                                        <div className="font-mono text-sm">${pack.price}</div>
                                    </button>
                                ))}
                            </div>

                        </div>
                    </div>

                    {/* Right Column: Main Settings Form */}
                    <div className="lg:col-span-2">
                        <div className="bg-[#111] p-8 rounded-lg border border-gray-800 shadow-2xl">
                            <form onSubmit={handleSubmit} className="space-y-8">
                                <input type="hidden" name="logo_url" value={profile?.logo_url || ''} />
                                <input type="hidden" name="watermark_logo_url" value={profile?.watermark_logo_url || ''} />
                                <div className="space-y-6">
                                    <h3 className="text-lg font-mono text-gray-500 border-b border-gray-800 pb-2 uppercase tracking-wider">
                                        Business Details
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="col-span-2">
                                            <label className="block text-gray-400 mb-2 font-mono text-xs uppercase tracking-widest flex items-center gap-2">
                                                <Building size={14} /> Shop Name
                                            </label>
                                            <input
                                                type="text"
                                                name="shop_name"
                                                defaultValue={profile?.shop_name || ''}
                                                className="w-full bg-black border border-gray-800 p-4 text-white rounded focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none transition-all placeholder:text-gray-800"
                                                placeholder="e.g. Acme Ironworks LLC"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-gray-400 mb-2 font-mono text-xs uppercase tracking-widest flex items-center gap-2">
                                                <Mail size={14} /> Contact Email
                                            </label>
                                            <input
                                                type="email"
                                                value={profile?.email || ''}
                                                disabled
                                                className="w-full bg-[#1a1a1a] border border-gray-800 p-4 text-gray-500 rounded cursor-not-allowed italic"
                                            />
                                            <p className="text-xs text-gray-700 mt-1">Managed via Auth Provider</p>
                                        </div>

                                        <div>
                                            <label className="block text-gray-400 mb-2 font-mono text-xs uppercase tracking-widest flex items-center gap-2">
                                                <Phone size={14} /> Business Phone
                                            </label>
                                            <input
                                                type="tel"
                                                name="phone"
                                                defaultValue={profile?.phone || ''}
                                                className="w-full bg-black border border-gray-800 p-4 text-white rounded focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none transition-all placeholder:text-gray-800"
                                                placeholder="(555) 123-4567"
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <label className="block text-gray-400 mb-2 font-mono text-xs uppercase tracking-widest flex items-center gap-2">
                                                <MapPin size={14} /> Shop Address
                                            </label>
                                            <textarea
                                                name="address"
                                                defaultValue={profile?.address || ''}
                                                rows={2}
                                                className="w-full bg-black border border-gray-800 p-4 text-white rounded focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none transition-all placeholder:text-gray-800 resize-none"
                                                placeholder="123 Steel Blvd, Industriville, ST 90210"
                                            />
                                        </div>

                                        <div className="col-span-1 border-t border-gray-800 pt-6 mt-2">
                                            <label className="block text-gray-400 mb-2 font-mono text-xs uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-[var(--primary)]"></div> Brand Color
                                            </label>
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="color"
                                                    name="primary_color"
                                                    defaultValue={profile?.primary_color || '#FFD700'}
                                                    className="w-16 h-16 p-1 bg-black border border-gray-800 rounded cursor-pointer hover:border-[var(--primary)] transition-colors"
                                                />
                                                <div className="text-gray-500 text-sm">
                                                    <p className="mb-1">Select your primary brand color.</p>
                                                    <p className="text-xs opacity-60">Default: #FFD700 (Industrial Gold)</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="col-span-1 border-t border-gray-800 pt-6 mt-2">
                                            <label className="block text-gray-400 mb-2 font-mono text-xs uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-gray-500"></div> Tool Background
                                            </label>
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="color"
                                                    name="tool_background_color"
                                                    defaultValue={profile?.tool_background_color || '#050505'}
                                                    className="w-16 h-16 p-1 bg-black border border-gray-800 rounded cursor-pointer hover:border-gray-500 transition-colors"
                                                />
                                                <div className="text-gray-500 text-sm">
                                                    <p className="mb-1">Background for the visualizer.</p>
                                                    <p className="text-xs opacity-60">Default: #050505 (Dark)</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Logo Size Control (REMOVED) */}
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-gray-800 flex items-center justify-between">
                                    <div className="text-sm">
                                        {message && (
                                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${message.includes('Error') ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
                                                {message.includes('Error') ? '⚠' : '✓'} {message}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="bg-[var(--primary)] hover:bg-white hover:text-black text-black font-bold uppercase font-mono px-8 py-3 rounded transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]"
                                    >
                                        {saving ? 'Saving...' : <><Save size={18} /> Save Changes</>}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
