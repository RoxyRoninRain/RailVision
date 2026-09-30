'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getTenantDetails, updateSubscriptionStatus, updateTenantCredentials, sendTenantPasswordReset, TenantDetailsResult } from '@/app/admin/actions';
import { 
    ArrowLeft, Mail, Phone, MapPin, Calendar, Shield, ExternalLink, 
    Palette, Sparkles, CreditCard, DollarSign, Clock, AlertTriangle, 
    CheckCircle2, TrendingUp, Cpu, BarChart3, Layers, Zap, RefreshCw,
    XCircle, CheckCircle, ArrowUpRight, UserCog, KeyRound, Copy, Check, X, Save, Loader2
} from 'lucide-react';
import Link from 'next/link';

export default function TenantShadowPage() {
    const params = useParams();
    const id = params?.id as string;

    const [data, setData] = useState<TenantDetailsResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'recent' | 'leads'>('daily');

    // Edit Credentials & Password Reset Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        shopName: '',
        email: '',
        phone: '',
        website: '',
    });
    const [isSavingCredentials, setIsSavingCredentials] = useState(false);
    const [credentialsMsg, setCredentialsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isSendingReset, setIsSendingReset] = useState(false);
    const [resetResult, setResetResult] = useState<{ success: boolean; email?: string; directLink?: string | null; error?: string } | null>(null);
    const [copiedLink, setCopiedLink] = useState(false);

    const loadData = async () => {
        if (!id) return;
        try {
            const res = await getTenantDetails(id);
            setData(res);
        } catch (err) {
            console.error('Failed to load tenant details:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    if (loading) return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
            <div className="text-red-500 font-mono animate-pulse tracking-widest flex items-center gap-3">
                <RefreshCw className="animate-spin w-5 h-5 text-red-500" />
                LOADING TENANT INTELLIGENCE...
            </div>
        </div>
    );

    if (!data || !data.profile) return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-gray-500">
            <h1 className="text-2xl font-mono text-white mb-4">TENANT NOT FOUND</h1>
            <p className="text-sm text-gray-600 mb-6 font-mono">No profile records exist for ID: {id}</p>
            <Link href="/admin/tenants" className="text-red-500 hover:underline font-mono text-sm">
                ← Return to Tenant Directory
            </Link>
        </div>
    );

    const { profile, leads, billing, generations } = data;

    const handleSubscription = async (newStatus: 'active' | 'cancelled') => {
        if (!confirm(`Are you sure you want to set subscription to: ${newStatus.toUpperCase()}?`)) return;

        const res = await updateSubscriptionStatus(id, newStatus);
        if (res.success) {
            setData((prev: any) => ({
                ...prev,
                profile: { ...prev.profile, subscription_status: newStatus },
                billing: {
                    ...prev.billing,
                    subscriptionStatus: newStatus,
                    isPastDue: newStatus === 'cancelled' ? false : prev.billing.isPastDue
                }
            }));
        } else {
            alert('Failed to update subscription: ' + res.error);
        }
    };

    const openEditModal = () => {
        if (data?.profile) {
            setEditForm({
                shopName: data.profile.shop_name || '',
                email: data.profile.email || '',
                phone: data.profile.phone || '',
                website: data.profile.website || '',
            });
            setCredentialsMsg(null);
            setResetResult(null);
            setCopiedLink(false);
            setIsEditModalOpen(true);
        }
    };

    const handleSaveCredentials = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingCredentials(true);
        setCredentialsMsg(null);
        try {
            const res = await updateTenantCredentials(id, {
                email: editForm.email,
                shopName: editForm.shopName,
                phone: editForm.phone,
                website: editForm.website,
            });
            if (res.error) {
                setCredentialsMsg({ type: 'error', text: res.error });
            } else {
                setCredentialsMsg({ type: 'success', text: 'Tenant account updated successfully!' });
                setData((prev: any) => ({
                    ...prev,
                    profile: {
                        ...prev.profile,
                        email: res.updated?.email || editForm.email,
                        shop_name: res.updated?.shop_name || editForm.shopName,
                        phone: res.updated?.phone ?? editForm.phone,
                        website: res.updated?.website ?? editForm.website,
                    }
                }));
            }
        } catch (err: any) {
            setCredentialsMsg({ type: 'error', text: err.message || 'Failed to update tenant' });
        } finally {
            setIsSavingCredentials(false);
        }
    };

    const handleSendReset = async () => {
        setIsSendingReset(true);
        setResetResult(null);
        setCopiedLink(false);
        try {
            const res = await sendTenantPasswordReset(id);
            if (res.error) {
                setResetResult({ success: false, error: res.error });
            } else {
                setResetResult({
                    success: true,
                    email: res.email,
                    directLink: res.directLink,
                });
            }
        } catch (err: any) {
            setResetResult({ success: false, error: err.message || 'Failed to send password reset' });
        } finally {
            setIsSendingReset(false);
        }
    };

    // Tier badge color mapping
    const getTierBadgeStyle = (tierName: string) => {
        const lower = (tierName || '').toLowerCase();
        if (lower.includes('volume')) return 'bg-amber-950/40 text-amber-400 border-amber-800/60 shadow-[0_0_15px_rgba(245,158,11,0.15)]';
        if (lower.includes('pro')) return 'bg-purple-950/40 text-purple-400 border-purple-800/60 shadow-[0_0_15px_rgba(168,85,247,0.15)]';
        if (lower.includes('unlimited')) return 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60 shadow-[0_0_15px_rgba(16,185,129,0.15)]';
        return 'bg-blue-950/40 text-blue-400 border-blue-800/60 shadow-[0_0_15px_rgba(59,130,246,0.15)]';
    };

    const formatDate = (isoString: string | null) => {
        if (!isoString) return 'Not Scheduled';
        try {
            return new Date(isoString).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch {
            return isoString;
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-red-500/30">
            {/* 1. PAST DUE EMERGENCY BANNER (Shown if payment is overdue) */}
            {billing.isPastDue && (
                <div className="bg-red-600/20 border-b border-red-500/50 text-red-400 px-6 py-3 flex items-center justify-between text-sm font-mono animate-pulse">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                        <div>
                            <span className="font-bold uppercase tracking-wider text-red-200">PAYMENT PAST DUE: </span>
                            <span>
                                Tenant has an outstanding balance of <span className="font-bold text-white">${billing.pastDueAmount > 0 ? billing.pastDueAmount.toFixed(2) : billing.amountPaying.basePrice.toFixed(2)}</span>. 
                                {billing.daysRemaining !== null && billing.daysRemaining < 0 
                                    ? ` Overdue by ${Math.abs(billing.daysRemaining)} day${Math.abs(billing.daysRemaining) === 1 ? '' : 's'}.` 
                                    : ' Stripe billing retry in progress.'}
                            </span>
                        </div>
                    </div>
                    <a 
                        href={`mailto:${profile.email}?subject=Urgent: Railify Account Payment Notice&body=Hello ${profile.shop_name || 'there'},%0D%0A%0D%0AYour Railify account payment is currently past due. Please update your payment method to ensure uninterrupted design studio service.`}
                        className="bg-red-600 hover:bg-red-500 text-white text-xs uppercase px-3 py-1.5 rounded font-bold transition-colors shrink-0"
                    >
                        Send Notice
                    </a>
                </div>
            )}

            {/* TOP BAR / NAVIGATION */}
            <header className="border-b border-white/10 bg-[#0a0a0a]">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/tenants" className="text-gray-400 hover:text-white flex items-center gap-2 text-xs font-mono transition-colors">
                            <ArrowLeft size={14} /> DIRECTORY
                        </Link>
                        <span className="text-gray-700">/</span>
                        <span className="text-xs font-mono text-gray-300 font-bold uppercase truncate max-w-[200px] md:max-w-none">
                            {profile.shop_name || 'Unnamed Tenant'}
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="text-xs font-mono text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700 px-2.5 py-1.5 rounded transition-colors flex items-center gap-1.5 disabled:opacity-50"
                            title="Refresh Tenant Metrics"
                        >
                            <RefreshCw size={12} className={refreshing ? 'animate-spin text-red-500' : ''} />
                            <span>REFRESH</span>
                        </button>
                        <div className="text-[10px] font-mono text-gray-500 border-l border-gray-800 pl-3 hidden sm:block">
                            ID: <span className="text-gray-400">{id.substring(0, 8)}...</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
                
                {/* 2. TENANT IDENTITY & HEADER CARD */}
                <div className="bg-[#111] border border-white/10 rounded-xl p-6 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gray-900 to-black border border-gray-800 flex items-center justify-center text-3xl font-black text-red-500 shadow-xl shrink-0">
                                {profile.shop_name ? profile.shop_name.substring(0, 1).toUpperCase() : '?'}
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                                    <h1 className="text-2xl font-bold text-white tracking-tight leading-none">
                                        {profile.shop_name || 'Unnamed Shop'}
                                    </h1>
                                    
                                    {/* TIER BADGE */}
                                    <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase tracking-wider border ${getTierBadgeStyle(billing.tier)}`}>
                                        {billing.tier} TIER
                                    </span>

                                    {/* STATUS BADGE */}
                                    {billing.isPastDue ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase tracking-wider bg-red-950/60 text-red-400 border border-red-800/80 animate-pulse">
                                            <AlertTriangle size={12} /> PAST DUE
                                        </span>
                                    ) : billing.subscriptionStatus === 'active' ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase tracking-wider bg-emerald-950/40 text-emerald-400 border border-emerald-800/50">
                                            <CheckCircle2 size={12} /> ACTIVE
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase tracking-wider bg-zinc-900 text-zinc-400 border border-zinc-800">
                                            <XCircle size={12} /> {billing.subscriptionStatus}
                                        </span>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-400 font-mono">
                                    <span className="flex items-center gap-1.5 text-gray-300">
                                        <Mail size={13} className="text-gray-500" />
                                        {profile.email}
                                    </span>
                                    {profile.phone && (
                                        <span className="flex items-center gap-1.5">
                                            <Phone size={13} className="text-gray-500" />
                                            {profile.phone}
                                        </span>
                                    )}
                                    {profile.website && (
                                        <a href={profile.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors">
                                            <ExternalLink size={12} />
                                            {profile.website.replace(/^https?:\/\//, '')}
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* QUICK ACTIONS BUTTONS */}
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={openEditModal}
                                className="bg-blue-950/40 hover:bg-blue-900/60 border border-blue-800/60 text-blue-300 px-3.5 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm"
                            >
                                <UserCog size={13} /> Edit Account & Credentials
                            </button>

                            <form action={async () => {
                                await import('@/app/actions/impersonation').then(mod => mod.impersonateTenant(id));
                            }}>
                                <button
                                    type="submit"
                                    className="bg-purple-950/30 hover:bg-purple-900/50 border border-purple-800/50 text-purple-300 px-3.5 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                                >
                                    <Shield size={13} /> View As Tenant
                                </button>
                            </form>

                            <Link
                                href={`/admin/tenants/${id}/test`}
                                className="bg-emerald-950/30 hover:bg-emerald-900/50 border border-emerald-800/50 text-emerald-300 px-3.5 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                            >
                                <Sparkles size={13} /> Test Styles ($0)
                            </Link>

                            <Link
                                href={`/admin/tenants/${id}/styles`}
                                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-gray-200 px-3.5 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                            >
                                <Palette size={13} /> Styles
                            </Link>
                        </div>
                    </div>
                </div>

                {/* 3. PRIMARY FINANCIAL & SUBSCRIPTION METRICS (4 CARDS) */}
                <div>
                    <h2 className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2">
                        <CreditCard size={14} className="text-red-500" />
                        Billing & Subscription Overview
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        
                        {/* CARD 1: SIGNED UP TIER */}
                        <div className="bg-[#111] border border-white/5 p-5 rounded-xl relative overflow-hidden group hover:border-white/10 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Plan Tier</span>
                                <Layers size={16} className="text-blue-500 opacity-60" />
                            </div>
                            <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-2xl font-bold font-mono text-white tracking-tight uppercase">
                                    {billing.tier}
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 font-mono mb-3">
                                {billing.tierConfig.allowance > 0 
                                    ? `${billing.tierConfig.allowance} designs included` 
                                    : 'Pay-as-you-go Utility'}
                            </p>
                            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-gray-500">
                                <span>White-label:</span>
                                <span className={billing.tierConfig.onboardingFee > 0 || billing.tier !== 'Starter' ? 'text-green-400' : 'text-gray-400'}>
                                    {billing.tier !== 'Starter' ? 'Enabled' : 'Railify Badge'}
                                </span>
                            </div>
                        </div>

                        {/* CARD 2: HOW MUCH THEY ARE PAYING */}
                        <div className="bg-[#111] border border-white/5 p-5 rounded-xl relative overflow-hidden group hover:border-white/10 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Amount Paying</span>
                                <DollarSign size={16} className="text-green-500 opacity-60" />
                            </div>
                            <div className="flex items-baseline gap-1 mb-1">
                                <span className="text-2xl font-bold font-mono text-white">
                                    ${billing.amountPaying.basePrice}
                                </span>
                                <span className="text-xs font-mono text-gray-500">/{billing.amountPaying.interval}</span>
                            </div>
                            <p className="text-xs text-purple-400 font-mono mb-3">
                                +${billing.amountPaying.overageRate.toFixed(2)}/extra render
                            </p>
                            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-gray-400">
                                <span className="text-gray-500">Current Cycle Est:</span>
                                <span className="font-bold text-white">${billing.amountPaying.currentCycleEstimatedTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* CARD 3: NEXT PAYMENT DUE DATE & PAST DUE STATUS */}
                        <div className={`p-5 rounded-xl border relative overflow-hidden group transition-colors ${
                            billing.isPastDue 
                                ? 'bg-red-950/20 border-red-900/40 hover:border-red-700/60' 
                                : 'bg-[#111] border-white/5 hover:border-white/10'
                        }`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Next Payment Due</span>
                                <Clock size={16} className={billing.isPastDue ? 'text-red-500' : 'text-yellow-500 opacity-60'} />
                            </div>
                            <div className="flex items-baseline gap-2 mb-1">
                                <span className={`text-xl font-bold font-mono ${billing.isPastDue ? 'text-red-400' : 'text-white'}`}>
                                    {formatDate(billing.nextPaymentDueDate)}
                                </span>
                            </div>
                            <div className="mb-3">
                                {billing.isPastDue ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-red-500">
                                        <AlertTriangle size={12} /> PAST DUE NOW
                                    </span>
                                ) : billing.daysRemaining !== null ? (
                                    <span className={`text-xs font-mono ${billing.daysRemaining <= 3 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                                        {billing.daysRemaining === 0 ? 'Due Today' : `Due in ${billing.daysRemaining} days`}
                                    </span>
                                ) : (
                                    <span className="text-xs font-mono text-gray-500">Subscription Active</span>
                                )}
                            </div>
                            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-gray-500">
                                <span>Status:</span>
                                <span className={`font-bold uppercase ${billing.isPastDue ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {billing.isPastDue ? 'Overdue' : 'Current'}
                                </span>
                            </div>
                        </div>

                        {/* CARD 4: TOTAL TENANT SPENT */}
                        <div className="bg-[#111] border border-white/5 p-5 rounded-xl relative overflow-hidden group hover:border-white/10 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Total Spent (LTV)</span>
                                <TrendingUp size={16} className="text-emerald-500 opacity-60" />
                            </div>
                            <div className="flex items-baseline gap-1 mb-1">
                                <span className="text-2xl font-bold font-mono text-white">
                                    ${billing.totalSpent.toFixed(2)}
                                </span>
                                <span className="text-xs font-mono text-gray-500">total</span>
                            </div>
                            <p className="text-xs text-gray-400 font-mono mb-3">
                                {billing.paidInvoicesCount} paid invoice{billing.paidInvoicesCount === 1 ? '' : 's'}
                            </p>
                            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-gray-500">
                                <span>Net Profit Margin:</span>
                                <span className={`font-bold ${generations.profitability.marginPercent >= 70 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                                    {generations.profitability.marginPercent}%
                                </span>
                            </div>
                        </div>

                    </div>
                </div>

                {/* 4. GENERATIONS USAGE (BY DAY, MONTH, YEAR) & ADMIN MODEL EXPENSES */}
                <div className="bg-[#0e0e0e] border border-white/10 rounded-xl p-6 space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Cpu className="w-5 h-5 text-red-500" />
                                <h2 className="text-lg font-bold font-mono text-white uppercase tracking-wide">
                                    Generation Activity & AI Model API Cost
                                </h2>
                            </div>
                            <p className="text-xs text-gray-500">
                                Visualizing tenant generation volume against your actual Google Vertex / Gemini API expenses.
                            </p>
                        </div>

                        {/* PROFIT SUMMARY PILL */}
                        <div className="flex items-center gap-4 bg-black/60 border border-white/10 px-4 py-2 rounded-lg font-mono text-xs">
                            <div>
                                <span className="text-gray-500 block text-[10px] uppercase">Tenant Paid</span>
                                <span className="font-bold text-white">${generations.profitability.revenue.toFixed(2)}</span>
                            </div>
                            <div className="text-gray-600">-</div>
                            <div>
                                <span className="text-gray-500 block text-[10px] uppercase">Model Cost (You)</span>
                                <span className="font-bold text-red-400">${generations.profitability.cost.toFixed(2)}</span>
                            </div>
                            <div className="text-gray-600">=</div>
                            <div>
                                <span className="text-gray-500 block text-[10px] uppercase">Your Gross Margin</span>
                                <span className="font-bold text-emerald-400">
                                    +${generations.profitability.grossProfit.toFixed(2)} ({generations.profitability.marginPercent}%)
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 4-COLUMN COMPARISON CARDS: DAY, MONTH, YEAR, TOTAL */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        
                        {/* TODAY (DAY) */}
                        <div className="bg-black/50 border border-white/5 rounded-lg p-4 relative group hover:border-red-900/30 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Today (Day)</span>
                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <span className="text-3xl font-black font-mono text-white">
                                        {generations.counts.day}
                                    </span>
                                    <span className="text-xs text-gray-500 font-mono ml-1.5">designs</span>
                                </div>
                                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                                    <span className="text-gray-500">Model Cost (Paid):</span>
                                    <span className="text-red-400 font-bold font-mono">${generations.modelCost.day.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* THIS MONTH */}
                        <div className="bg-black/50 border border-white/5 rounded-lg p-4 relative group hover:border-purple-900/30 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">This Month</span>
                                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <span className="text-3xl font-black font-mono text-white">
                                        {generations.counts.month}
                                    </span>
                                    <span className="text-xs text-gray-500 font-mono ml-1.5">designs</span>
                                </div>
                                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                                    <span className="text-gray-500">Model Cost (Paid):</span>
                                    <span className="text-red-400 font-bold font-mono">${generations.modelCost.month.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* THIS YEAR */}
                        <div className="bg-black/50 border border-white/5 rounded-lg p-4 relative group hover:border-emerald-900/30 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">This Year</span>
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <span className="text-3xl font-black font-mono text-white">
                                        {generations.counts.year}
                                    </span>
                                    <span className="text-xs text-gray-500 font-mono ml-1.5">designs</span>
                                </div>
                                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                                    <span className="text-gray-500">Model Cost (Paid):</span>
                                    <span className="text-red-400 font-bold font-mono">${generations.modelCost.year.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* ALL TIME */}
                        <div className="bg-black/50 border border-white/5 rounded-lg p-4 relative group hover:border-yellow-900/30 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">All Time</span>
                                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <span className="text-3xl font-black font-mono text-white">
                                        {generations.counts.total}
                                    </span>
                                    <span className="text-xs text-gray-500 font-mono ml-1.5">total designs</span>
                                </div>
                                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                                    <span className="text-gray-500">Total Model API Cost:</span>
                                    <span className="text-red-400 font-bold font-mono">${generations.modelCost.total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* DETAILED ACTIVITY TABS */}
                    <div className="pt-2">
                        <div className="flex items-center justify-between border-b border-white/10 mb-4">
                            <div className="flex items-center gap-1 font-mono text-xs">
                                <button
                                    onClick={() => setActiveTab('daily')}
                                    className={`px-4 py-2 border-b-2 font-bold uppercase transition-colors ${
                                        activeTab === 'daily'
                                            ? 'border-red-500 text-white bg-white/5'
                                            : 'border-transparent text-gray-500 hover:text-gray-300'
                                    }`}
                                >
                                    Daily Breakdown ({generations.dailyBreakdown.length} Days)
                                </button>
                                <button
                                    onClick={() => setActiveTab('monthly')}
                                    className={`px-4 py-2 border-b-2 font-bold uppercase transition-colors ${
                                        activeTab === 'monthly'
                                            ? 'border-red-500 text-white bg-white/5'
                                            : 'border-transparent text-gray-500 hover:text-gray-300'
                                    }`}
                                >
                                    Monthly Breakdown ({generations.monthlyBreakdown.length} Months)
                                </button>
                                <button
                                    onClick={() => setActiveTab('recent')}
                                    className={`px-4 py-2 border-b-2 font-bold uppercase transition-colors ${
                                        activeTab === 'recent'
                                            ? 'border-red-500 text-white bg-white/5'
                                            : 'border-transparent text-gray-500 hover:text-gray-300'
                                    }`}
                                >
                                    Recent Generations Log ({generations.recent.length})
                                </button>
                                <button
                                    onClick={() => setActiveTab('leads')}
                                    className={`px-4 py-2 border-b-2 font-bold uppercase transition-colors ${
                                        activeTab === 'leads'
                                            ? 'border-red-500 text-white bg-white/5'
                                            : 'border-transparent text-gray-500 hover:text-gray-300'
                                    }`}
                                >
                                    Leads ({leads.length})
                                </button>
                            </div>
                        </div>

                        {/* TAB CONTENT: DAILY */}
                        {activeTab === 'daily' && (
                            <div className="bg-black/60 rounded-lg border border-white/5 overflow-hidden">
                                {generations.dailyBreakdown.length > 0 ? (
                                    <table className="w-full text-left text-xs font-mono">
                                        <thead className="bg-[#151515] text-gray-400 border-b border-white/5">
                                            <tr>
                                                <th className="p-3 pl-4">Date</th>
                                                <th className="p-3">Generations Completed</th>
                                                <th className="p-3 text-right pr-4">Admin Model API Cost</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {generations.dailyBreakdown.map(d => (
                                                <tr key={d.date} className="hover:bg-white/[0.02]">
                                                    <td className="p-3 pl-4 text-white font-medium">{d.label}</td>
                                                    <td className="p-3">
                                                        <span className="text-purple-400 font-bold">{d.count}</span> renders
                                                    </td>
                                                    <td className="p-3 text-right pr-4 text-red-400 font-bold">
                                                        ${d.cost.toFixed(3)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-8 text-center text-gray-600 font-mono italic text-xs">
                                        No daily generation records found for this tenant.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB CONTENT: MONTHLY */}
                        {activeTab === 'monthly' && (
                            <div className="bg-black/60 rounded-lg border border-white/5 overflow-hidden">
                                {generations.monthlyBreakdown.length > 0 ? (
                                    <table className="w-full text-left text-xs font-mono">
                                        <thead className="bg-[#151515] text-gray-400 border-b border-white/5">
                                            <tr>
                                                <th className="p-3 pl-4">Month</th>
                                                <th className="p-3">Generations Completed</th>
                                                <th className="p-3 text-right pr-4">Admin Model API Cost</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {generations.monthlyBreakdown.map(m => (
                                                <tr key={m.month} className="hover:bg-white/[0.02]">
                                                    <td className="p-3 pl-4 text-white font-medium">{m.label}</td>
                                                    <td className="p-3">
                                                        <span className="text-purple-400 font-bold">{m.count}</span> renders
                                                    </td>
                                                    <td className="p-3 text-right pr-4 text-red-400 font-bold">
                                                        ${m.cost.toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-8 text-center text-gray-600 font-mono italic text-xs">
                                        No monthly generation records found for this tenant.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB CONTENT: RECENT GENERATIONS LOG */}
                        {activeTab === 'recent' && (
                            <div className="bg-black/60 rounded-lg border border-white/5 overflow-hidden">
                                {generations.recent.length > 0 ? (
                                    <table className="w-full text-left text-xs font-mono">
                                        <thead className="bg-[#151515] text-gray-400 border-b border-white/5">
                                            <tr>
                                                <th className="p-3 pl-4">Time</th>
                                                <th className="p-3">Style Applied</th>
                                                <th className="p-3">Model Engine</th>
                                                <th className="p-3">Tokens (In / Out)</th>
                                                <th className="p-3 text-right pr-4">Model Cost</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {generations.recent.map(g => (
                                                <tr key={g.id} className="hover:bg-white/[0.02]">
                                                    <td className="p-3 pl-4 text-gray-400">
                                                        {new Date(g.created_at).toLocaleString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </td>
                                                    <td className="p-3 text-white font-medium">
                                                        {g.style_id}
                                                        {g.isAdminTest && (
                                                            <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800">
                                                                ADMIN TEST
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-gray-400 text-[11px]">{g.model_id}</td>
                                                    <td className="p-3 text-gray-500">
                                                        {g.input_tokens.toLocaleString()} / {g.output_tokens.toLocaleString()}
                                                    </td>
                                                    <td className="p-3 text-right pr-4 text-red-400 font-bold">
                                                        ${g.cost.toFixed(4)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-8 text-center text-gray-600 font-mono italic text-xs">
                                        No recent generation logs found for this tenant.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB CONTENT: LEADS */}
                        {activeTab === 'leads' && (
                            <div className="bg-black/60 rounded-lg border border-white/5 overflow-hidden">
                                {leads && leads.length > 0 ? (
                                    <table className="w-full text-left text-xs font-mono">
                                        <thead className="bg-[#151515] text-gray-400 border-b border-white/5">
                                            <tr>
                                                <th className="p-3 pl-4">Customer</th>
                                                <th className="p-3">Style</th>
                                                <th className="p-3">Status</th>
                                                <th className="p-3 text-right pr-4">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {leads.map((lead: any) => (
                                                <tr key={lead.id} className="hover:bg-white/[0.02]">
                                                    <td className="p-3 pl-4">
                                                        <div className="font-medium text-white">{lead.customer_name || 'Anonymous Customer'}</div>
                                                        <div className="text-[11px] text-gray-500">{lead.email}</div>
                                                    </td>
                                                    <td className="p-3 text-gray-300">{lead.style_name || '-'}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                                            lead.status === 'New' ? 'bg-blue-900/30 text-blue-400 border border-blue-800/40' :
                                                            lead.status === 'Closed' ? 'bg-green-900/30 text-green-400 border border-green-800/40' :
                                                            'bg-gray-800 text-gray-400'
                                                        }`}>
                                                            {lead.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right pr-4 text-gray-500">
                                                        {new Date(lead.created_at).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-8 text-center text-gray-600 font-mono italic text-xs">
                                        No leads recorded for this tenant yet.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 5. SUBSCRIPTION MANAGEMENT & STORAGE ACTIONS (LOWER SECTION) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* SUBSCRIPTION CONTROLS */}
                    <div className="bg-[#111] border border-white/10 rounded-xl p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                            <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <CreditCard size={16} className="text-gray-400" />
                                Subscription Controls
                            </h3>
                            <span className="text-[10px] font-mono text-gray-500">
                                STRIPE: {billing.hasStripeAccount ? 'CONNECTED' : 'UNLINKED'}
                            </span>
                        </div>

                        <div className="space-y-3">
                            {billing.subscriptionStatus === 'active' ? (
                                <button
                                    onClick={() => handleSubscription('cancelled')}
                                    className="w-full text-center bg-red-950/20 hover:bg-red-950/40 border border-red-900/50 text-red-400 rounded-lg py-3 text-xs font-mono font-bold uppercase tracking-wider transition-colors"
                                >
                                    Cancel Subscription
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleSubscription('active')}
                                    className="w-full text-center bg-green-950/20 hover:bg-green-950/40 border border-green-900/50 text-green-400 rounded-lg py-3 text-xs font-mono font-bold uppercase tracking-wider transition-colors"
                                >
                                    Reactivate Subscription
                                </button>
                            )}

                            <a
                                href={`mailto:${profile.email}`}
                                className="block w-full text-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-2.5 text-xs text-gray-300 font-mono transition-colors"
                            >
                                Contact Tenant Directly ({profile.email})
                            </a>

                            {billing.stripeCustomerId && (
                                <a
                                    href={`https://dashboard.stripe.com/customers/${billing.stripeCustomerId}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-center gap-1.5 w-full bg-blue-950/20 hover:bg-blue-950/40 border border-blue-900/40 text-blue-400 rounded-lg py-2.5 text-xs font-mono transition-colors"
                                >
                                    <span>Open Stripe Customer Profile</span>
                                    <ArrowUpRight size={14} />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* ENVIRONMENT & ASSETS ACCESS */}
                    <div className="bg-[#111] border border-white/10 rounded-xl p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                            <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <Shield size={16} className="text-purple-400" />
                                Workspace & Style Operations
                            </h3>
                            <span className="text-[10px] font-mono text-gray-500">SAFE MODE</span>
                        </div>

                        <div className="space-y-3">
                            <Link
                                href={`/admin/tenants/${id}/assets`}
                                className="flex items-center justify-center gap-2 w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-gray-300 rounded-lg py-2.5 text-xs font-mono font-bold uppercase tracking-wider transition-colors"
                            >
                                <ExternalLink size={14} /> View All Storage Assets
                            </Link>

                            <Link
                                href={`/admin/tenants/${id}/test`}
                                className="flex items-center justify-center gap-2 w-full bg-emerald-950/30 hover:bg-emerald-950/50 border border-emerald-800/50 text-emerald-400 rounded-lg py-2.5 text-xs font-mono font-bold uppercase tracking-wider transition-colors"
                            >
                                <Sparkles size={14} /> Test Tenant Styles (Zero-Charge)
                            </Link>

                            <Link
                                href={`/admin/tenants/${id}/styles`}
                                className="flex items-center justify-center gap-2 w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg py-2.5 text-xs font-mono font-bold uppercase tracking-wider transition-colors"
                            >
                                <Palette size={14} /> Manage Tenant Styles Catalog
                            </Link>
                        </div>
                    </div>

                </div>

            </main>

            {/* EDIT ACCOUNT & PASSWORD RESET MODAL */}
            {isEditModalOpen && (
                <div 
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsEditModalOpen(false);
                    }}
                >
                    <div className="bg-[#111] border border-gray-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-gray-800/80 flex items-center justify-between bg-zinc-950/60">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-950/40 border border-blue-800/60 flex items-center justify-center text-blue-400">
                                    <UserCog size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white tracking-tight">Edit Tenant Account</h2>
                                    <p className="text-xs font-mono text-gray-500">ID: {id}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* SECTION 1: CREDENTIALS & PROFILE FORM */}
                            <form onSubmit={handleSaveCredentials} className="space-y-4">
                                <div className="text-xs font-mono uppercase tracking-wider text-gray-400 font-bold flex items-center gap-2">
                                    <span>Account & Branding Details</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-mono text-gray-400 mb-1">
                                            Shop / User Name
                                        </label>
                                        <input
                                            type="text"
                                            value={editForm.shopName}
                                            onChange={(e) => setEditForm({ ...editForm, shopName: e.target.value })}
                                            className="w-full bg-black/60 border border-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                            placeholder="e.g. Iron Works Co."
                                            required
                                        />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-mono text-gray-400 mb-1">
                                            Login & Contact Email
                                        </label>
                                        <input
                                            type="email"
                                            value={editForm.email}
                                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                            className="w-full bg-black/60 border border-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                            placeholder="tenant@example.com"
                                            required
                                        />
                                        <p className="text-[11px] text-gray-500 mt-1">
                                            Updating this updates both their Supabase Auth login credentials and their store profile without losing historical data or access.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-mono text-gray-400 mb-1">
                                            Phone Number
                                        </label>
                                        <input
                                            type="text"
                                            value={editForm.phone}
                                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                            className="w-full bg-black/60 border border-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                            placeholder="(555) 123-4567"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-mono text-gray-400 mb-1">
                                            Website
                                        </label>
                                        <input
                                            type="text"
                                            value={editForm.website}
                                            onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                                            className="w-full bg-black/60 border border-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                            placeholder="https://example.com"
                                        />
                                    </div>
                                </div>

                                {credentialsMsg && (
                                    <div className={`p-3 rounded-lg text-xs font-mono ${
                                        credentialsMsg.type === 'success' 
                                            ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-300' 
                                            : 'bg-red-950/40 border border-red-900/60 text-red-300'
                                    }`}>
                                        {credentialsMsg.text}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isSavingCredentials}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold uppercase tracking-wider py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isSavingCredentials ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    Save Account Changes
                                </button>
                            </form>

                            {/* SECTION 2: PASSWORD RESET WORKFLOW */}
                            <div className="border-t border-gray-800/80 pt-6">
                                <div className="bg-purple-950/20 border border-purple-900/40 rounded-xl p-5 space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-purple-950/60 border border-purple-800/60 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
                                            <KeyRound size={16} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-white">Password Reset Workflow</h3>
                                            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                                                Send a secure password recovery link to <span className="text-purple-300 font-mono font-semibold">{data.profile.email}</span>. The link will take them directly to the password reset page to choose a new password.
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleSendReset}
                                        disabled={isSendingReset}
                                        className="w-full bg-purple-900/40 hover:bg-purple-800/60 border border-purple-700/60 text-purple-200 font-mono text-xs font-bold uppercase tracking-wider py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isSendingReset ? (
                                            <>
                                                <Loader2 size={14} className="animate-spin" />
                                                Sending Recovery Email...
                                            </>
                                        ) : (
                                            <>
                                                <KeyRound size={14} />
                                                Send Password Reset Link
                                            </>
                                        )}
                                    </button>

                                    {resetResult && (
                                        <div className="space-y-3 pt-2">
                                            {resetResult.success ? (
                                                <div className="bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 p-3 rounded-lg text-xs font-mono space-y-2">
                                                    <div className="flex items-center gap-1.5 font-bold">
                                                        <CheckCircle2 size={14} className="text-emerald-400" />
                                                        <span>Password reset link sent to {resetResult.email}!</span>
                                                    </div>

                                                    {resetResult.directLink && (
                                                        <div className="mt-2 pt-2 border-t border-emerald-900/40 space-y-1.5">
                                                            <div className="flex items-center justify-between text-gray-400 text-[11px]">
                                                                <span>Direct Recovery Link (Optional):</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(resetResult.directLink!);
                                                                        setCopiedLink(true);
                                                                        setTimeout(() => setCopiedLink(false), 2500);
                                                                    }}
                                                                    className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                                                                >
                                                                    {copiedLink ? <Check size={12} /> : <Copy size={12} />}
                                                                    {copiedLink ? 'Copied!' : 'Copy Link'}
                                                                </button>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                readOnly
                                                                value={resetResult.directLink}
                                                                onClick={(e) => (e.target as HTMLInputElement).select()}
                                                                className="w-full bg-black/60 border border-emerald-900/60 text-emerald-200 px-2 py-1.5 rounded text-[11px] font-mono select-all outline-none"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="bg-red-950/40 border border-red-900/60 text-red-300 p-3 rounded-lg text-xs font-mono flex items-center gap-2">
                                                    <AlertTriangle size={14} className="text-red-400 shrink-0" />
                                                    <span>{resetResult.error || 'Failed to send password reset.'}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-gray-800/80 bg-zinc-950/60 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsEditModalOpen(false)}
                                className="bg-zinc-800 hover:bg-zinc-700 text-gray-300 px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
