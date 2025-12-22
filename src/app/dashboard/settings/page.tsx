'use client';

import { useState, useEffect, useRef } from 'react';
import { getProfile, updateProfile, uploadLogo, Profile } from '@/app/actions';
import { Save, Upload, Building, Phone, MapPin, Mail, CreditCard, ShieldCheck, Image as ImageIcon, Trash2, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function SettingsPage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingWatermark, setUploadingWatermark] = useState(false);
    const [message, setMessage] = useState('');
    const [travelSettings, setTravelSettings] = useState<any>({ pricing_type: 'radius_tiers', tiers: [] });
    const [isTravelCollapsed, setIsTravelCollapsed] = useState(true);
    const watermarkInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        getProfile().then(data => {
            if (data) {
                setProfile(data);
                if (data.travel_settings) {
                    setTravelSettings(data.travel_settings);
                }
            }
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
                    website: formData.get('website') as string,
                });
            }
        } else {
            setMessage('Error updating profile: ' + res.error);
        }
        setSaving(false);
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

                        {/* Contact Support Block - Moved */}
                        <div className="bg-[#111] p-6 rounded-lg border border-gray-800 shadow-xl relative overflow-hidden group">
                            <h2 className="text-xl font-mono font-bold text-white mb-4 flex items-center gap-2">
                                <Mail className="text-gray-400" size={20} />
                                Contact
                            </h2>
                            <div>
                                <label className="block text-gray-400 mb-2 font-mono text-xs uppercase tracking-widest">
                                    Registered Email
                                </label>
                                <div className="w-full bg-[#1a1a1a] border border-gray-800 p-3 text-gray-500 rounded italic text-sm truncate">
                                    {profile?.email}
                                </div>
                                <p className="text-[10px] text-gray-700 mt-2">Managed via Auth Provider</p>
                            </div>
                        </div>

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

                        {/* Usage & Billing Status */}
                        <div className="bg-[#111] p-6 rounded-lg border border-gray-800 shadow-xl relative">
                            <h2 className="text-xl font-mono font-bold text-white mb-4 flex items-center gap-2">
                                <CreditCard className="text-gray-400" size={20} />
                                Metered Billing
                            </h2>

                            {/* Tier Badge */}
                            <div className="flex items-center justify-between bg-black/40 p-3 rounded border border-gray-800 mb-4">
                                <span className="text-gray-400 font-mono text-sm uppercase">Current Plan</span>
                                <span className="text-[var(--primary)] font-bold font-mono uppercase tracking-wider">
                                    {profile?.tier_name || 'The Estimator'}
                                </span>
                            </div>

                            {/* Usage Bar */}
                            <div className="mb-6">
                                <div className="flex justify-between text-xs font-mono mb-2 uppercase tracking-wide">
                                    <span className="text-white">Monthly Usage</span>
                                    <span className={profile?.enable_overdrive && (profile?.current_usage || 0) > 50 ? 'text-orange-500' : 'text-gray-400'}>
                                        {profile?.current_usage || 0} Renders
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-500 ${(profile?.current_usage || 0) > 50 // simplistic check, ideally use tier.allowance if available in context
                                            ? 'bg-orange-500'
                                            : 'bg-green-500'
                                            }`}
                                        style={{ width: `${Math.min(100, Math.max(5, ((profile?.current_usage || 0) / 50) * 100))}%` }}
                                    />
                                </div>
                                {(profile?.current_usage || 0) > 50 && (
                                    <p className="text-xs text-orange-500 mt-1 font-mono uppercase">
                                        Overdrive Active
                                    </p>
                                )}
                            </div>

                            {/* Overdrive Toggle */}
                            <div className="bg-white/5 p-4 rounded border border-gray-700 flex items-center justify-between mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className={`w-2 h-2 rounded-full ${profile?.enable_overdrive ? 'bg-orange-500 animate-pulse' : 'bg-gray-600'}`} />
                                        <span className="font-bold text-sm text-white uppercase tracking-wider">Overdrive™</span>
                                    </div>
                                    <p className="text-xs text-gray-500">Allow overage generation</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="enable_overdrive_toggle" // Handled via hidden input in main form actually
                                        checked={profile?.enable_overdrive || false}
                                        onChange={(e) => {
                                            if (profile) setProfile({ ...profile, enable_overdrive: e.target.checked });
                                            // We need to auto-submit or let the main form handle it. 
                                            // Since main form wraps right column, this left column is OUTSIDE the form.
                                            // We need to handle this separately or move it.
                                            // WAIT: This card is in Left Column. Main form is Right Column.
                                            // I must make this interactable independently or move it.
                                            // For now, I'll use a hidden form or fetch call?
                                            // Simpler: Just rely on independent update? Use updateProfile directly here.

                                            const fd = new FormData();
                                            fd.append('enable_overdrive', e.target.checked.toString());
                                            setSaving(true);
                                            updateProfile(fd).then(res => {
                                                setSaving(false);
                                                if (res.success) setMessage('Overdrive settings updated.');
                                            });
                                        }}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                                </label>
                            </div>

                        </div>

                        {/* Risk Management (Moved) */}
                        <div className="bg-white/5 p-4 rounded border border-gray-700 mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <ShieldCheck className="text-gray-400" size={16} />
                                <span className="font-bold text-sm text-white uppercase tracking-wider">Spend Limit</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500 text-sm">$</span>
                                <input
                                    type="number"
                                    name="max_monthly_spend"
                                    defaultValue={profile?.max_monthly_spend || ''}
                                    placeholder="No Limit"
                                    className="w-full bg-black border border-gray-800 p-1 px-2 text-white rounded focus:border-[var(--primary)] outline-none text-sm font-mono"
                                    onBlur={(e) => {
                                        const fd = new FormData();
                                        fd.append('max_monthly_spend', e.target.value);
                                        setSaving(true);
                                        updateProfile(fd).then(res => {
                                            setSaving(false);
                                            if (res.success) setMessage('Risk limits updated.');
                                        });
                                    }}
                                />
                            </div>
                            <p className="text-[10px] text-gray-600 mt-2">
                                Hard stop for Overdrive charges.
                            </p>
                        </div>

                        {/* Financial Snapshot */}
                        <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono uppercase">
                            <div className="bg-black/30 p-2 rounded border border-gray-800">
                                <span className="block text-gray-500 mb-1">Pending Overage</span>
                                <span className="text-white font-bold">${profile?.pending_overage_balance || '0.00'}</span>
                            </div>
                            <div className="bg-black/30 p-2 rounded border border-gray-800">
                                <span className="block text-gray-500 mb-1">Next Bill</span>
                                <span className="text-white font-bold">$49.00</span>
                            </div>
                        </div>

                        <div className="mt-4 text-center">
                            <Link href="/pricing" className="text-sm text-gray-500 hover:text-white transition-colors underline decoration-dotted">
                                View Tier Limits
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Right Column: Main Settings Form */}
                <div className="space-y-8">
                    <div className="bg-[#111] p-8 rounded-lg border border-gray-800 shadow-2xl">
                        <form onSubmit={handleSubmit} className="space-y-8">
                            <input type="hidden" name="logo_url" value={profile?.logo_url || ''} />
                            <input type="hidden" name="logo_url" value={profile?.logo_url || ''} />
                            <input type="hidden" name="watermark_logo_url" value={profile?.watermark_logo_url || ''} />
                            <input type="hidden" name="travel_settings" value={JSON.stringify(travelSettings)} />

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

                                    <div className="col-span-2">
                                        <label className="block text-gray-400 mb-2 font-mono text-xs uppercase tracking-widest flex items-center gap-2">
                                            <ShieldCheck size={14} /> Website / Whitelisted Domains
                                        </label>
                                        <input
                                            type="text"
                                            name="website"
                                            defaultValue={profile?.website || ''}
                                            className="w-full bg-black border border-gray-800 p-4 text-white rounded focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none transition-all placeholder:text-gray-800"
                                            placeholder="https://mysite.com, https://app.gohighlevel.com"
                                        />
                                        <p className="text-xs text-gray-600 mt-2">
                                            Comma-separated list of domains allowed to embed your widget.
                                        </p>
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
                                            <MapPin size={14} /> Shop Address & Zip
                                        </label>
                                        <div className="flex gap-4">
                                            <div className="flex-grow">
                                                <textarea
                                                    name="address"
                                                    defaultValue={profile?.address || ''}
                                                    rows={2}
                                                    className="w-full bg-black border border-gray-800 p-4 text-white rounded focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none transition-all placeholder:text-gray-800 resize-none"
                                                    placeholder="123 Steel Blvd, Industriville"
                                                />
                                            </div>
                                            <div className="w-32">
                                                <input
                                                    type="text"
                                                    name="address_zip"
                                                    defaultValue={profile?.address_zip || ''}
                                                    className="w-full bg-black border border-gray-800 p-4 text-white rounded focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none transition-all placeholder:text-gray-800"
                                                    placeholder="Zip"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Travel Settings Moved */}



                                    <div className="col-span-2 border-t border-gray-800 pt-6 mt-2">
                                        <label className="block text-gray-400 mb-2 font-mono text-xs uppercase tracking-widest flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-green-500"></div> Customer Confirmation Email
                                        </label>
                                        <p className="text-xs text-gray-500 mb-4">
                                            Customize the email sent to customers when they request a quote.
                                        </p>
                                        <textarea
                                            name="confirmation_email_body"
                                            defaultValue={profile?.confirmation_email_body || "Thank you for your request. We will review your project and get back to you shortly."}
                                            rows={6}
                                            className="w-full bg-[#111] border border-gray-800 p-4 text-white rounded focus:border-[var(--primary)] outline-none transition-all placeholder:text-gray-800 resize-y font-sans text-sm"
                                            placeholder="Enter your confirmation message here..."
                                        />
                                    </div>

                                    {/* Travel Settings - Collapsible Moved */}
                                    <div className="col-span-2 border-t border-gray-800 pt-6 mt-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsTravelCollapsed(!isTravelCollapsed)}
                                            className="w-full flex items-center justify-between text-left group"
                                        >
                                            <label className="text-gray-400 font-mono text-xs uppercase tracking-widest flex items-center gap-2 cursor-pointer group-hover:text-white transition-colors">
                                                <div className="w-3 h-3 rounded-full bg-blue-500"></div> Travel Fees
                                            </label>
                                            {isTravelCollapsed ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronUp size={16} className="text-gray-500" />}
                                        </button>

                                        {!isTravelCollapsed && (
                                            <div className="mt-6 animate-fade-in bg-black/50 rounded border border-gray-800 p-4 space-y-4">
                                                <div className="flex gap-4 mb-4">
                                                    <div className="flex-1">
                                                        <span className="text-xs text-gray-500 uppercase block mb-1">Pricing Strategy</span>
                                                        <select
                                                            value={travelSettings.pricing_type || 'radius_tiers'}
                                                            onChange={e => setTravelSettings({ ...travelSettings, pricing_type: e.target.value })}
                                                            className="w-full bg-[#050505] border border-gray-800 text-sm rounded p-2 text-white"
                                                        >
                                                            <option value="radius_tiers">Radius Tiers</option>
                                                            <option value="per_mile">Per Mile Rate</option>
                                                        </select>
                                                    </div>
                                                    <div className="flex-1">
                                                        <span className="text-xs text-gray-500 uppercase block mb-1">Application Method</span>
                                                        <select
                                                            value={travelSettings.application_type || 'flat'}
                                                            onChange={e => setTravelSettings({ ...travelSettings, application_type: e.target.value })}
                                                            className="w-full bg-[#050505] border border-gray-800 text-sm rounded p-2 text-white"
                                                        >
                                                            <option value="flat">Standard (Flat Fee)</option>
                                                            <option value="per_foot_surcharge">Surcharge (Per Foot)</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {travelSettings.pricing_type === 'per_mile' ? (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="text-xs text-gray-500 uppercase block mb-1">Base Fee ($)</label>
                                                            <input
                                                                type="number"
                                                                value={travelSettings.base_fee === 0 ? 0 : (travelSettings.base_fee || '')}
                                                                onChange={e => {
                                                                    const val = parseFloat(e.target.value);
                                                                    setTravelSettings({ ...travelSettings, base_fee: isNaN(val) ? '' : val });
                                                                }}
                                                                className="w-full bg-[#050505] border border-gray-800 rounded p-2 text-white"
                                                                placeholder="0.00"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs text-gray-500 uppercase block mb-1">Rate ($/Mile)</label>
                                                            <input
                                                                type="number"
                                                                value={travelSettings.rate_per_mile === 0 ? 0 : (travelSettings.rate_per_mile || '')}
                                                                onChange={e => {
                                                                    const val = parseFloat(e.target.value);
                                                                    setTravelSettings({ ...travelSettings, rate_per_mile: isNaN(val) ? '' : val });
                                                                }}
                                                                className="w-full bg-[#050505] border border-gray-800 rounded p-2 text-white"
                                                                placeholder="0.00"
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-4">
                                                        <div className="space-y-2">
                                                            {travelSettings.tiers?.map((tier: any, idx: number) => (
                                                                <div key={idx} className="flex items-center gap-2">
                                                                    <div className="relative flex-1">
                                                                        <span className="absolute left-3 top-2.5 text-xs text-gray-500">0 -</span>
                                                                        <input
                                                                            type="number"
                                                                            value={tier.radius === 0 ? 0 : (tier.radius || '')}
                                                                            onChange={e => {
                                                                                const newTiers = [...(travelSettings.tiers || [])];
                                                                                const val = parseFloat(e.target.value);
                                                                                newTiers[idx].radius = isNaN(val) ? '' : val;
                                                                                setTravelSettings({ ...travelSettings, tiers: newTiers });
                                                                            }}
                                                                            className="w-full bg-[#050505] border border-gray-800 rounded p-2 pl-8 text-sm text-white"
                                                                            placeholder="Miles"
                                                                        />
                                                                        <span className="absolute right-3 top-2.5 text-xs text-gray-500">mi</span>
                                                                    </div>
                                                                    <span className="text-gray-500 text-sm">→</span>
                                                                    <div className="relative flex-1">
                                                                        <span className="absolute left-3 top-2.5 text-xs text-gray-500">$</span>
                                                                        <input
                                                                            type="number"
                                                                            value={tier.price === 0 ? 0 : (tier.price || '')}
                                                                            onChange={e => {
                                                                                const newTiers = [...(travelSettings.tiers || [])];
                                                                                const val = parseFloat(e.target.value);
                                                                                newTiers[idx].price = isNaN(val) ? '' : val;
                                                                                setTravelSettings({ ...travelSettings, tiers: newTiers });
                                                                            }}
                                                                            className="w-full bg-[#050505] border border-gray-800 rounded p-2 pl-6 text-sm text-white"
                                                                            placeholder="Fee"
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newTiers = travelSettings.tiers.filter((_: any, i: number) => i !== idx);
                                                                            setTravelSettings({ ...travelSettings, tiers: newTiers });
                                                                        }}
                                                                        className="text-red-500 hover:text-red-400 p-2"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const newTiers = [...(travelSettings.tiers || []), { radius: 20, price: 50 }];
                                                                setTravelSettings({ ...travelSettings, tiers: newTiers });
                                                            }}
                                                            className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] hover:underline flex items-center gap-1"
                                                        >
                                                            <Plus size={14} /> Add Distance Tier
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
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
    );
}
