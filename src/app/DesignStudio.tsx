'use client';

import { useState, useEffect, useRef } from 'react';
import { InputSanitizer } from '@/components/security/InputSanitizer';
import { generateDesign, submitLead, convertHeicToJpg } from './actions';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, Check, Loader2, ArrowRight, MousePointerClick, TrendingUp, AlertCircle, Quote,
    Download, Image as ImageIcon, Settings, Maximize2, RefreshCw, X, ChevronRight, ChevronLeft
} from 'lucide-react';
import clsx from 'clsx';
import { compressImage } from '@/utils/imageUtils';
import StyleControls from './StyleControls';
import { DownloadGateModal } from '@/components/DownloadGateModal';

interface style {
    id: string;
    name: string;
    description: string;
    image_url?: string;
}

interface TenantProfile {
    shop_name: string | null;
    logo_url?: string | null;
    phone?: string | null;
    address?: string | null;
    primary_color?: string | null;
}

interface DesignStudioProps {
    styles: style[];
    tenantProfile: TenantProfile | null;
    orgId: string;
}

export default function DesignStudio({ styles: initialStyles, tenantProfile, orgId }: DesignStudioProps) {
    // --- STATE ---
    const [step, setStep] = useState(1); // 1=Upload, 2=Style, 3=Result
    const [direction, setDirection] = useState(0);

    // Data
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [selectedStyleIndex, setSelectedStyleIndex] = useState(0);
    const [customStyleFile, setCustomStyleFile] = useState<File | null>(null);
    const [styleSource, setStyleSource] = useState<'preset' | 'upload'>('preset');

    // Gate State
    const [showGate, setShowGate] = useState(false);
    const [isGateUnlocked, setIsGateUnlocked] = useState(false); // Valid for session

    // Branding
    const [logo, setLogo] = useState<string | null>(tenantProfile?.logo_url || null);
    const [primaryColor, setPrimaryColor] = useState(tenantProfile?.primary_color || '#FFD700');

    // Processing
    const [result, setResult] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Quote
    const [quoteOpen, setQuoteOpen] = useState(false);
    const [customerName, setCustomerName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState('');
    const [leadStatus, setLeadStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

    // Mobile UI State
    const [showStyleSheet, setShowStyleSheet] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);


    const styleList = initialStyles;

    // Effects
    useEffect(() => {
        if (tenantProfile?.logo_url) setLogo(tenantProfile.logo_url);
        if (tenantProfile?.primary_color) setPrimaryColor(tenantProfile.primary_color);
    }, [tenantProfile]);

    const primaryRgb = hexToRgb(primaryColor);

    // --- NAVIGATION ---
    const paginate = (newDirection: number) => {
        setDirection(newDirection);
        setStep((prev) => prev + newDirection);
    };

    const jumpTo = (newStep: number) => {
        setDirection(newStep > step ? 1 : -1);
        setStep(newStep);
    }

    const [isProcessing, setIsProcessing] = useState(false);

    // --- HANDLERS ---
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setIsProcessing(true); // Start loading
            setError(null); // Clear previous errors

            try {
                const compressed = await compressImage(selectedFile);
                setFile(compressed);
                setPreview(URL.createObjectURL(compressed));
                paginate(1); // Auto-advance
            } catch (err) {
                console.warn("Client-side compression failed:", err);

                // If HEIC failed, try Server-Side Conversion (Fallback)
                const isHeic = selectedFile.name.toLowerCase().endsWith('.heic') || selectedFile.name.toLowerCase().endsWith('.heif');

                if (isHeic) {
                    try {
                        console.log("Attempting server-side HEIC conversion...");
                        const formData = new FormData();
                        formData.append('file', selectedFile);

                        // We need to import this action. Since it's a server action, Next.js handles the bridge.
                        // However, we can't import inside a function effectively if not already imported.
                        // Assuming it's available via import from './actions'. 
                        // I will add the import to the top of file in a separate step if needed, 
                        // but `generateDesign` is already imported from there, so I'll just use it if available 
                        // or rely on auto-import/manual import check.
                        // WAIT: I must ensure it is imported. I will check imports first? 
                        // No, I'll assume I need to add it to the import list.
                        // For this Replace, I will write the logic assuming `convertHeicToJpg` is imported.

                        const result = await convertHeicToJpg(formData);

                        if (result.success && result.base64) {
                            console.log("Server-side conversion successful");

                            // Convert Data URI to Blob directly (more robust than fetch)
                            const base64Data = result.base64.split(',')[1];
                            const byteCharacters = atob(base64Data);
                            const byteArrays = [];

                            for (let offset = 0; offset < byteCharacters.length; offset += 512) {
                                const slice = byteCharacters.slice(offset, offset + 512);
                                const byteNumbers = new Array(slice.length);
                                for (let i = 0; i < slice.length; i++) {
                                    byteNumbers[i] = slice.charCodeAt(i);
                                }
                                const byteArray = new Uint8Array(byteNumbers);
                                byteArrays.push(byteArray);
                            }

                            const blob = new Blob(byteArrays, { type: 'image/jpeg' });
                            const newFile = new File([blob], selectedFile.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });

                            setFile(newFile);
                            setPreview(result.base64);
                            paginate(1);
                            return;
                        } else {
                            throw new Error(result.error || "Server conversion failed");
                        }
                    } catch (serverErr) {
                        console.error("Server conversion failed:", serverErr);
                        setError("Could not convert iPhone photo. Please try a JPG or PNG.");
                    }
                } else {
                    // Fallback to original file for standard formats
                    console.log("Falling back to original file for preview.");
                    setFile(selectedFile);
                    setPreview(URL.createObjectURL(selectedFile));
                    paginate(1);
                }
            } finally {
                setIsProcessing(false); // Stop loading regardless of outcome
            }
        }
    };

    const handleGenerate = async () => {
        if (!file) return;
        setIsGenerating(true);
        setError(null);
        setResult(null);

        // Advance to step 3 (Loading State)
        if (step !== 3) paginate(1);

        try {
            const formData = new FormData();
            formData.append('image', file);

            // Handle Style Source
            if (styleSource === 'preset') {
                formData.append('styleId', styleList[selectedStyleIndex].id);
                formData.append('style', styleList[selectedStyleIndex].name);
                // CRITICAL FIX: Send the image URL so the server can use the actual visual reference
                // instead of relying on the text name (which fails for custom uploads).
                if (styleList[selectedStyleIndex].image_url) {
                    formData.append('style_url', styleList[selectedStyleIndex].image_url);
                }
            } else if (styleSource === 'upload' && customStyleFile) {
                formData.append('style_image', customStyleFile);
                formData.append('style', 'Custom Style');
            } else {
                // Fallback to first style if custom selected but no file
                formData.append('styleId', styleList[0].id);
                formData.append('style', styleList[0].name);
                if (styleList[0].image_url) {
                    formData.append('style_url', styleList[0].image_url);
                }
            }

            formData.append('prompt', "High quality architectural photorealistic render"); // Basic prompt, server handles rest

            console.log("Calling generateDesign with formData...");
            const response = await generateDesign(formData);
            console.log("generateDesign response:", response);

            if (response.success && response.data) {
                console.log("Success! Setting result.");
                setResult(response.data);
            } else {
                console.error("Generation failed:", response.error);
                setError(response.error || "Generation failed");
                setStep(2); // Go back to style selection on error
            }

        } catch (err) {
            console.error("Catch block validation:", err);
            setError("Network error");
            setStep(2);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleQuoteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLeadStatus('submitting');
        try {
            const formData = new FormData();
            formData.append('customer_name', customerName);
            formData.append('email', email);
            formData.append('phone', phone);
            formData.append('message', message);
            formData.append('style_name', styleList[selectedStyleIndex]?.name || 'Custom');
            if (result) formData.append('generated_design_url', result);
            if (orgId) formData.append('organization_id', orgId);

            await submitLead(formData);
            setLeadStatus('success');
            setTimeout(() => {
                setQuoteOpen(false);
                setLeadStatus('idle');
            }, 3000);
        } catch (err) {
            console.error(err);
            setLeadStatus('error');
        }
    };


    // --- DOWNLOAD HANDLERS ---
    const handleDownloadClick = () => {
        if (!result) return;
        if (isGateUnlocked) {
            executeDownload();
        } else {
            setShowGate(true);
        }
    };

    const handleGateSubmit = async (data: { name: string; email: string }) => {
        // Save Lead (Soft)
        const formData = new FormData();
        formData.append('customer_name', data.name);
        formData.append('email', data.email);
        formData.append('style_name', styleList[selectedStyleIndex]?.name || 'Custom');
        formData.append('status', 'New'); // Or 'Soft Lead' if supported
        if (orgId) formData.append('organization_id', orgId);
        if (result) formData.append('generated_design_url', result); // Optional: save image link

        // Fire and forget submission to not block user too long, 
        // or await if we want strict confirm. Awaiting is safer.
        try {
            await submitLead(formData);
        } catch (e) {
            console.warn("Lead soft-save failed", e);
        }

        setIsGateUnlocked(true);
        // Modal will close itself after success animation, we wait 1s in modal, 
        // but here we just need to ensure download starts when modal calls onSuccess (or we trigger it here)
        // Actually modal logic says: setSuccess -> wait 1s -> onClose.
        // We should trigger download *after* unlocking.
        // Let's pass a callback or just trigger it here.
        setTimeout(() => {
            executeDownload();
            setShowGate(false);
        }, 1000);
    };

    const executeDownload = () => {
        if (!result) return;

        const canvas = document.createElement('canvas');
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = result;
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Draw Base Image
            ctx.drawImage(img, 0, 0);

            // Draw Watermark (Logo) if available
            if (logo) {
                const logoImg = new Image();
                logoImg.crossOrigin = "anonymous";
                logoImg.src = logo;
                // We need to wait for logo? For simplicity assume cached or try sync
                // In real app, promise-all the loads. here we try:
                // If logo fails to load instantly, we might skip it. 
                // Better approach: Load it
                logoImg.onload = () => {
                    const logoSize = Math.max(canvas.width * 0.15, 100); // 15% width
                    const aspectRatio = logoImg.width / logoImg.height;
                    const drawWidth = logoSize;
                    const drawHeight = logoSize / aspectRatio;
                    const padding = canvas.width * 0.03;

                    ctx.globalAlpha = 0.9;
                    ctx.drawImage(logoImg, canvas.width - drawWidth - padding, canvas.height - drawHeight - padding, drawWidth, drawHeight);
                    ctx.globalAlpha = 1.0;
                    downloadCanvas(canvas);
                };
                logoImg.onerror = () => downloadCanvas(canvas); // Fallback
            } else {
                // Default Text Watermark
                ctx.font = `bold ${canvas.width * 0.03}px monospace`;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.textAlign = 'right';
                ctx.fillText('POWERED BY RAILIFY', canvas.width - (canvas.width * 0.02), canvas.height - (canvas.width * 0.02));
                downloadCanvas(canvas);
            }
        };
    };

    const downloadCanvas = (canvas: HTMLCanvasElement) => {
        const link = document.createElement('a');
        link.download = `Railify-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    // --- UTILS ---
    function hexToRgb(hex: string) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : '255 215 0';
    }


    // --- ANIMATION VARIANTS ---
    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? '100%' : '-100%',
            opacity: 0,
            zIndex: 0,
            position: 'absolute' as 'absolute'
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
            position: 'absolute' as 'absolute'
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? '100%' : '-100%',
            opacity: 0,
            position: 'absolute' as 'absolute'
        })
    };


    // --- RENDER ---
    return (
        <main
            className="fixed inset-0 z-50 bg-[#050505] text-white flex flex-col font-sans selection:bg-[var(--primary)] selection:text-black overflow-hidden"
            style={{
                // @ts-ignore
                '--primary': primaryColor,
                '--primary-rgb': primaryRgb
            }}
        >
            {/* Header */}
            <header className="absolute top-0 left-0 right-0 z-50 p-6 flex justify-between items-center pointer-events-none">
                <div className="pointer-events-auto flex items-center gap-4">
                    <h1 className="text-2xl font-black text-[var(--primary)] uppercase tracking-tighter cursor-pointer" onClick={() => window.location.reload()}>
                        Railify
                    </h1>
                </div>
                {/* Steps */}
                <div className="flex gap-2 pointer-events-auto">
                    {[1, 2, 3].map(s => (
                        <button
                            key={s}
                            onClick={() => s < step ? jumpTo(s) : null}
                            className={clsx(
                                "w-3 h-3 rounded-full transition-all duration-300",
                                step === s ? "bg-[var(--primary)] scale-125" : (s < step ? "bg-gray-500 hover:bg-white cursor-pointer" : "bg-[#222]")
                            )}
                        />
                    ))}
                </div>
            </header>

            {/* WIZARD CONTENT */}
            <div className="flex-1 relative w-full h-full">
                <AnimatePresence initial={false} custom={direction}>

                    {/* STEP 1: UPLOAD */}
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            custom={direction}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                            className="w-full h-full flex flex-col items-center justify-center p-6 bg-[#050505]"
                        >
                            <div className="max-w-2xl w-full text-center space-y-12">
                                <div className="space-y-4">
                                    <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">
                                        Transform Your <span className="text-[var(--primary)]">Space</span>
                                    </h2>
                                    <p className="text-gray-400 text-lg md:text-xl max-w-lg mx-auto leading-relaxed">
                                        Upload a photo of your staircase to instantly visualize premium handrail designs.
                                    </p>
                                </div>

                                <div className="relative group max-w-xl mx-auto w-full aspect-[16/9] md:aspect-[2/1] bg-[#0A0A0A] rounded-3xl border-2 border-dashed border-[#222] hover:border-[var(--primary)] transition-all duration-300 flex flex-col items-center justify-center cursor-pointer hover:bg-[#0e0e0e] hover:shadow-[0_0_30px_-5px_var(--primary-rgb)]">
                                    <input type="file" onChange={handleFileChange} className="absolute inset-0 z-20 opacity-0 cursor-pointer" accept="image/*, .heic, .heif" />
                                    <div className="w-16 h-16 bg-[#151515] rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                        <Upload className="w-8 h-8 text-[var(--primary)]" />
                                    </div>
                                    <p className="text-xl font-bold uppercase tracking-widest mb-2">Upload Photo</p>
                                    <p className="text-xs text-gray-500 font-mono">JPG, PNG, HEIC (Max 10MB)</p>

                                    {/* Processing Overlay */}
                                    {isProcessing && (
                                        <div className="absolute inset-0 z-30 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm rounded-3xl">
                                            <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mb-4" />
                                            <p className="text-white font-bold tracking-wider animate-pulse">PROCESSING IMAGE...</p>
                                        </div>
                                    )}
                                </div>

                                {/* Demo / Skip */}
                                {/* <button className="text-xs text-gray-600 hover:text-white underline decoration-dotted">Try with a demo image</button> */}
                            </div>
                        </motion.div>
                    )}


                    {/* STEP 2: VISUALIZE */}
                    {step === 2 && (
                        <motion.section
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="max-w-6xl mx-auto h-full flex flex-col lg:block"
                        >
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-12 h-full lg:h-auto">
                                {/* Left: Preview (Sticky on Mobile) */}
                                <div className={clsx(
                                    "lg:col-span-4 space-y-6 transition-all duration-300",
                                    isFullscreen ? "fixed inset-0 z-50 bg-black flex items-center justify-center p-0" : "relative shrink-0"
                                )}>
                                    <div className={clsx("sticky top-0 lg:top-28 w-full", isFullscreen ? "h-full" : "bg-black/80 backdrop-blur-sm lg:bg-transparent pt-4 pb-2 z-10")}>
                                        {!isFullscreen && (
                                            <h3 className="text-gray-500 font-mono text-xs uppercase mb-4 tracking-widest hidden lg:block">Target Structure</h3>
                                        )}

                                        <div className={clsx(
                                            "relative overflow-hidden border border-[var(--secondary)] transition-all",
                                            isFullscreen ? "w-full h-full border-none rounded-none" : "rounded-xl max-h-[50vh] mx-auto"
                                        )}>
                                            {preview && (
                                                <img
                                                    src={preview}
                                                    alt="Original"
                                                    className={clsx(
                                                        "object-contain transition-all",
                                                        isFullscreen ? "w-full h-full" : "w-full opacity-80"
                                                    )}
                                                />
                                            )}

                                            {/* Fullscreen Toggle */}
                                            <button
                                                onClick={() => setIsFullscreen(!isFullscreen)}
                                                className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-[var(--primary)] hover:text-black transition-colors z-20"
                                            >
                                                {isFullscreen ? <X className="w-6 h-6" /> : <Maximize2 className="w-5 h-5" />}
                                            </button>

                                            {!isFullscreen && (
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-6 pointer-events-none">
                                                    <p className="text-white font-mono text-sm">ORIGINAL_CAPTURE.JPG</p>
                                                </div>
                                            )}
                                        </div>

                                        {!isFullscreen && (
                                            <div className="mt-4 p-4 bg-[#111] border border-gray-800 rounded-lg hidden lg:block">
                                                <h4 className="text-[var(--primary)] mb-2 font-mono text-sm">System Ready</h4>
                                                <p className="text-gray-500 text-sm leading-relaxed">
                                                    Our AI engine will analyze structural hardpoints and overlay the selected aesthetic while maintaining perspective geometry.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Controls (Desktop) / Bottom Sheet (Mobile) */}
                                <div className="lg:col-span-8 flex-1 flex flex-col justify-end lg:justify-start pb-24 lg:pb-0">

                                    {/* MOBILE: Bottom Bar Summary */}
                                    <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-[#0a0a0a] border-t border-[var(--secondary)] z-30 flex items-center gap-4 safe-area-bottom">
                                        <div
                                            onClick={() => setShowStyleSheet(true)}
                                            className="flex-1 bg-[#111] border border-[var(--secondary)] rounded-lg p-3 flex items-center justify-between cursor-pointer active:scale-95 transition-transform"
                                        >
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase tracking-wider">Current Style</p>
                                                <p className="text-[var(--primary)] font-bold uppercase truncate max-w-[150px]">
                                                    {styleSource === 'upload' ? 'Custom Ref' : (styleList[selectedStyleIndex]?.name || 'No Style')}
                                                </p>
                                            </div>
                                            <Settings className="w-5 h-5 text-gray-400" />
                                        </div>
                                        <button
                                            onClick={handleGenerate}
                                            disabled={isGenerating || (styleSource === 'upload' && !customStyleFile)}
                                            className="btn-primary py-3 px-6 h-full flex items-center justify-center bg-[var(--primary)] text-black border-none"
                                        >
                                            {isGenerating ? <Loader2 className="animate-spin w-6 h-6" /> : <ArrowRight className="w-6 h-6" />}
                                        </button>
                                    </div>

                                    {/* MOBILE: Bottom Sheet for Styles */}
                                    <AnimatePresence>
                                        {showStyleSheet && (
                                            <>
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    onClick={() => setShowStyleSheet(false)}
                                                    className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm"
                                                />
                                                <motion.div
                                                    initial={{ y: "100%" }}
                                                    animate={{ y: 0 }}
                                                    exit={{ y: "100%" }}
                                                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                                    className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a] z-50 rounded-t-2xl border-t border-[var(--primary)] p-6 pb-12 max-h-[85vh] overflow-y-auto lg:hidden safe-area-bottom"
                                                >
                                                    <div className="w-12 h-1 bg-gray-800 rounded-full mx-auto mb-6" />
                                                    <div className="flex justify-between items-center mb-6">
                                                        <h3 className="text-xl font-bold text-white uppercase">Customize Look</h3>
                                                        <button onClick={() => setShowStyleSheet(false)} className="p-2 bg-gray-900 rounded-full">
                                                            <X className="w-5 h-5" />
                                                        </button>
                                                    </div>

                                                    {/* Style Controls Content (Mobile Clone) */}
                                                    <StyleControls
                                                        styleSource={styleSource}
                                                        setStyleSource={setStyleSource}
                                                        styles={styleList}
                                                        selectedStyleIndex={selectedStyleIndex}
                                                        setSelectedStyleIndex={(i) => { setSelectedStyleIndex(i); setShowStyleSheet(false); }}
                                                        customStyleFile={customStyleFile}
                                                        setCustomStyleFile={setCustomStyleFile}
                                                        error={error}
                                                    />
                                                </motion.div>
                                            </>
                                        )}
                                    </AnimatePresence>

                                    {/* DESKTOP: Standard Layout */}
                                    <div className="hidden lg:block h-full flex flex-col justify-start pt-8">
                                        <h3 className="text-3xl font-black uppercase tracking-tighter mb-8 text-center md:text-left">Select Style</h3>

                                        {/* Carousel Container */}
                                        <div className="relative aspect-square w-full max-w-[400px] mx-auto bg-[#111] rounded-2xl overflow-hidden border border-[#222] group shadow-2xl mb-8">
                                            {styleList.length > 0 ? (
                                                <>
                                                    <AnimatePresence mode='wait'>
                                                        <motion.img
                                                            key={styleList[selectedStyleIndex].id}
                                                            src={styleList[selectedStyleIndex].image_url || '/styles/industrial.png'}
                                                            initial={{ opacity: 0, scale: 1.1 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0 }}
                                                            transition={{ duration: 0.4 }}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </AnimatePresence>
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent flex flex-col justify-end p-8">
                                                        <h4 className="text-white text-4xl font-black uppercase italic mb-2">{styleList[selectedStyleIndex].name}</h4>
                                                        <p className="text-gray-300 text-sm max-w-md">{styleList[selectedStyleIndex].description}</p>
                                                    </div>

                                                    {/* Arrows */}
                                                    {styleList.length > 1 && (
                                                        <>
                                                            <button onClick={() => { setSelectedStyleIndex((prev) => (prev - 1 + styleList.length) % styleList.length); }} className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-[var(--primary)] hover:text-black text-white p-3 rounded-full backdrop-blur-md transition-all border border-white/10">
                                                                <ChevronLeft className="w-6 h-6" />
                                                            </button>
                                                            <button onClick={() => { setSelectedStyleIndex((prev) => (prev + 1) % styleList.length); }} className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-[var(--primary)] hover:text-black text-white p-3 rounded-full backdrop-blur-md transition-all border border-white/10">
                                                                <ChevronRight className="w-6 h-6" />
                                                            </button>
                                                        </>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-500">
                                                    <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
                                                    <p className="font-bold uppercase tracking-wider">No Active Styles</p>
                                                    <p className="text-xs mt-2">Please upload a custom style or check your settings.</p>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={handleGenerate}
                                            disabled={isGenerating || (styleSource === 'upload' && !customStyleFile)}
                                            className="w-full max-w-[400px] mx-auto py-6 bg-[var(--primary)] text-black font-bold text-xl uppercase tracking-wider hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 rounded-lg"
                                        >
                                            {isGenerating ? (
                                                <>
                                                    <Loader2 className="w-6 h-6 animate-spin" />
                                                    Processing...
                                                </>
                                            ) : (
                                                <>
                                                    Generate Visualization <TrendingUp className="w-6 h-6" />
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* LOADING OVERLAY */}
                                    <AnimatePresence>
                                        {isGenerating && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="fixed inset-0 bg-black/95 z-[60] flex flex-col items-center justify-center p-8 backdrop-blur-sm"
                                            >
                                                <div className="w-full max-w-md text-center">
                                                    <div className="mb-8 relative">
                                                        <div className="w-24 h-24 border-4 border-[var(--secondary)] border-t-[var(--primary)] rounded-full animate-spin mx-auto" />
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="w-16 h-16 bg-[var(--primary)]/20 rounded-full animate-pulse" />
                                                        </div>
                                                    </div>

                                                    <h3 className="text-2xl font-bold text-white mb-2">Generating Concept</h3>
                                                    <p className="text-[var(--primary)] font-mono text-sm uppercase tracking-widest animate-pulse">
                                                        AI Architect is working...
                                                    </p>

                                                    <div className="mt-8 w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                                                        <motion.div
                                                            className="h-full bg-[var(--primary)]"
                                                            initial={{ width: "0%" }}
                                                            animate={{ width: "100%" }}
                                                            transition={{ duration: 8, ease: "linear" }}
                                                        />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </motion.section>
                    )}

                    {/* STEP 3: RESULT */}
                    {step === 3 && (
                        <motion.div
                            key="step3"
                            custom={direction}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            className="w-full h-full bg-[#050505] flex items-center justify-center"
                        >
                            {isGenerating ? (
                                <div className="text-center">
                                    <div className="w-24 h-24 border-4 border-[#222] border-t-[var(--primary)] rounded-full animate-spin mx-auto mb-8" />
                                    <h2 className="text-3xl font-black uppercase tracking-widest animate-pulse">Forging Vision</h2>
                                    <p className="text-gray-500 mt-4 font-mono">Applying {styleList[selectedStyleIndex].name} aesthetics...</p>
                                </div>
                            ) : (
                                <div className="relative w-full h-full flex flex-col">
                                    {/* Result Area */}
                                    <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                                        {result && <img src={result} className="w-full h-full object-contain" />}

                                        {/* Dynamic Watermark */}
                                        {logo && result && (
                                            <img src={logo} className="absolute bottom-8 right-8 w-32 md:w-48 opacity-90 drop-shadow-xl" />
                                        )}

                                        {/* Back Button */}
                                        <button onClick={() => paginate(-1)} className="absolute top-28 left-8 bg-black/50 text-white px-4 py-2 rounded-full backdrop-blur-md border border-white/10 hover:bg-white hover:text-black transition-all flex items-center gap-2 text-sm uppercase font-bold tracking-widest">
                                            <ChevronLeft className="w-4 h-4" /> Adjust Style
                                        </button>

                                        {/* Reset Button */}
                                        <button onClick={() => { setFile(null); setPreview(null); setResult(null); setStep(1); }} className="absolute top-28 right-8 bg-black/50 text-white px-4 py-2 rounded-full backdrop-blur-md border border-white/10 hover:bg-red-500 hover:text-white transition-all flex items-center gap-2 text-sm uppercase font-bold tracking-widest">
                                            <RefreshCw className="w-4 h-4" /> Start Over
                                        </button>
                                    </div>

                                    {/* Action Bar */}
                                    <div className="bg-[#0A0A0A] border-t border-[#222] p-6 flex justify-center gap-4">
                                        <button onClick={() => setQuoteOpen(true)} className="px-8 py-4 bg-white text-black font-black uppercase tracking-widest rounded hover:bg-gray-200 transition-colors text-sm md:text-base">
                                            Request Quote
                                        </button>
                                        <button onClick={handleDownloadClick} className="px-8 py-4 bg-[var(--primary)] text-black font-black uppercase tracking-widest rounded hover:brightness-110 transition-colors shadow-[0_0_20px_-5px_var(--primary)] flex items-center gap-2 text-sm md:text-base">
                                            <Download className="w-5 h-5" /> Download High-Res
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>

            {/* Quote Modal */}
            <AnimatePresence>
                {quoteOpen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            className="bg-[#111] border border-[#333] p-8 rounded-2xl max-w-md w-full relative shadow-2xl"
                        >
                            <button onClick={() => setQuoteOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X /></button>

                            <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Request Quote</h2>
                            <p className="text-gray-400 text-sm mb-6">Our engineers will review your design and provide a detailed estimate.</p>

                            {leadStatus === 'success' ? (
                                <div className="bg-green-900/20 border border-green-900 rounded p-6 text-center text-green-500">
                                    <Check className="w-12 h-12 mx-auto mb-4" />
                                    <p className="font-bold uppercase tracking-widest">Request Sent Successfully</p>
                                </div>
                            ) : (
                                <form onSubmit={handleQuoteSubmit} className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-mono text-gray-500 uppercase">Contact Name</label>
                                        <input
                                            className="w-full bg-[#050505] border border-[#333] p-4 rounded text-white focus:border-[var(--primary)] outline-none transition-colors"
                                            value={customerName}
                                            onChange={e => setCustomerName(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-mono text-gray-500 uppercase">Email Address</label>
                                        <input
                                            type="email"
                                            className="w-full bg-[#050505] border border-[#333] p-4 rounded text-white focus:border-[var(--primary)] outline-none transition-colors"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-mono text-gray-500 uppercase">Phone Number</label>
                                        <input
                                            type="tel"
                                            className="w-full bg-[#050505] border border-[#333] p-4 rounded text-white focus:border-[var(--primary)] outline-none transition-colors"
                                            value={phone}
                                            onChange={e => setPhone(e.target.value)}
                                            placeholder="(555) 123-4567"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-mono text-gray-500 uppercase">Project Details</label>
                                        <textarea
                                            className="w-full bg-[#050505] border border-[#333] p-4 rounded text-white focus:border-[var(--primary)] outline-none transition-colors h-24 resize-none"
                                            value={message}
                                            onChange={e => setMessage(e.target.value)}
                                            placeholder="Tell us about your project..."
                                        />
                                    </div>
                                    <button type="submit" disabled={leadStatus === 'submitting'} className="w-full py-4 bg-[var(--primary)] text-black font-bold uppercase tracking-widest rounded hover:shadow-[0_0_20px_var(--primary)] transition-all mt-4">
                                        {leadStatus === 'submitting' ? 'Processing...' : 'Send Request'}
                                    </button>
                                </form>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Email Gate Modal */}
            <DownloadGateModal
                isOpen={showGate}
                onClose={() => setShowGate(false)}
                onSubmit={handleGateSubmit}
            />

        </main>
    );
}
