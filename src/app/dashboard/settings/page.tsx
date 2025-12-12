'use client';

import { useState, useEffect } from 'react';
import { getProfile, updateProfile, Profile } from '@/app/actions';
import { Save } from 'lucide-react';

export default function SettingsPage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

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
            // Update local state if needed
        } else {
            setMessage('Error updating profile: ' + res.error);
        }
        setSaving(false);
    };

    if (loading) return <div className="p-8 text-white">Loading settings...</div>;

    return (
        <div className="min-h-screen bg-[#0a0a0a] p-8 text-white">
            <h1 className="text-3xl font-mono text-[var(--primary)] mb-8">Business Settings</h1>

            <div className="max-w-2xl bg-[#111] p-8 rounded border border-gray-800">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-gray-400 mb-2 font-mono text-sm uppercase">Shop Name</label>
                        <input
                            type="text"
                            name="shop_name"
                            defaultValue={profile?.shop_name || ''}
                            className="w-full bg-black border border-gray-800 p-3 text-white rounded focus:border-[var(--primary)] outline-none transition-colors"
                            placeholder="e.g. Acme Fabricators"
                        />
                    </div>

                    <div>
                        <label className="block text-gray-400 mb-2 font-mono text-sm uppercase">Email (Read Only)</label>
                        <input
                            type="email"
                            value={profile?.email || ''}
                            disabled
                            className="w-full bg-[#1a1a1a] border border-gray-800 p-3 text-gray-500 rounded cursor-not-allowed"
                        />
                    </div>

                    <div>
                        <label className="block text-gray-400 mb-2 font-mono text-sm uppercase">Subscription Status</label>
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${profile?.subscription_status === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span className="capitalize">{profile?.subscription_status}</span>
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-[var(--primary)] text-black font-bold uppercase font-mono px-6 py-3 rounded hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : <><Save size={18} /> Save Changes</>}
                        </button>
                    </div>

                    {message && (
                        <div className={`p-4 rounded ${message.includes('Error') ? 'bg-red-900/20 text-red-400' : 'bg-green-900/20 text-green-400'}`}>
                            {message}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
