'use client';

import { useState, useEffect, useRef } from 'react';
import { InputSanitizer } from '@/components/security/InputSanitizer';
import { generateDesign, submitLead, convertHeicToJpg } from '@/app/actions';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, Check, Loader2, ArrowRight, MousePointerClick, TrendingUp, AlertCircle, Quote,
    Download, Image as ImageIcon, Settings, Maximize2, RefreshCw, X, ChevronRight, ChevronLeft
} from 'lucide-react';
import clsx from 'clsx';
import { compressImage } from '@/utils/imageUtils';
import StyleControls from '@/components/StyleControls';
import { DownloadGateModal } from '@/components/DownloadGateModal';
import { EstimateModal } from '@/components/EstimateModal';

interface style {
    id: string;
    name: string;
    description: string;
    image_url?: string;
    price_per_ft_min?: number;
    price_per_ft_max?: number;
}

interface TenantProfile {
    shop_name: string | null;
    logo_url?: string | null;
    phone?: string | null;
    address?: string | null;
    primary_color?: string | null;
    tool_background_color?: string | null;
    logo_size?: number | null;
    watermark_logo_url?: string | null;
}

interface DesignStudioProps {
    styles: style[];
    tenantProfile: TenantProfile | null;
    orgId: string;
    dashboardUrl?: string;
}

export default function DesignStudio({ styles: initialStyles, tenantProfile, orgId, dashboardUrl }: DesignStudioProps) {
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
    const [watermarkLogo, setWatermarkLogo] = useState<string | null>(tenantProfile?.watermark_logo_url || tenantProfile?.logo_url || null);
    const [shopName, setShopName] = useState<string | null>(tenantProfile?.shop_name || null);
    const [primaryColor, setPrimaryColor] = useState(tenantProfile?.primary_color || '#FFD700');
    const [toolBackgroundColor, setToolBackgroundColor] = useState(tenantProfile?.tool_background_color || '#050505');


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
    const [currentEstimate, setCurrentEstimate] = useState<any>(null); // New State
    const [leadStatus, setLeadStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [quoteFiles, setQuoteFiles] = useState<File[]>([]);

    // Mobile UI State
    const [showStyleSheet, setShowStyleSheet] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Manual Download Modal State
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [showEstimate, setShowEstimate] = useState(false);


    const styleList = initialStyles;

    // Effects
    useEffect(() => {
        if (tenantProfile?.logo_url) setLogo(tenantProfile.logo_url);
        if (tenantProfile?.watermark_logo_url) {
            setWatermarkLogo(tenantProfile.watermark_logo_url);
        } else if (tenantProfile?.logo_url) {
            // Fallback to main logo if no specific watermark is set
            setWatermarkLogo(tenantProfile.logo_url);
        }
        if (tenantProfile?.shop_name) setShopName(tenantProfile.shop_name);
        if (tenantProfile?.primary_color) setPrimaryColor(tenantProfile.primary_color);
        if (tenantProfile?.tool_background_color) setToolBackgroundColor(tenantProfile.tool_background_color);

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

            // Fix for Embedded Auth issues:
            // Ensure orgId is passed for guest/embedded users so the server can bill the tenant.
            if (orgId) {
                formData.append('organization_id', orgId);
            }

            formData.append('prompt', "High quality architectural photorealistic render"); // Basic prompt, server handles rest

            console.log("Calling generateDesign with formData...");
            console.log("File:", file.name, file.type, file.size);
            console.log("Style:", styleList[selectedStyleIndex].name);

            const response = await generateDesign(formData);
            console.log("generateDesign response received (success/fail):", response.success);

            // Explicit log for debugging mobile failures
            if (!response.success) {
                console.error("Server reported failure:", response.error);
            }

            if (response.success && response.image) {
                console.log("Success! Setting result.");
                setResult(response.image);
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
            if (currentEstimate) formData.append('estimate_json', JSON.stringify(currentEstimate));

            // Append Files
            quoteFiles.forEach(file => {
                formData.append('files', file);
            });

            const response = await submitLead(formData);

            if (response.success) {
                setLeadStatus('success');
                setTimeout(() => {
                    setQuoteOpen(false);
                    setLeadStatus('idle');
                }, 3000);
            } else {
                console.error("Quote submission failed:", response.error);
                setLeadStatus('error');
                // Optional: Show alert or toast
                alert(`Something went wrong: ${response.error || 'Unknown error'}`);
            }
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
        console.log("Starting download execution...");

        const canvas = document.createElement('canvas');
        const img = new Image();

        // Only set crossOrigin if it's NOT a data URI
        if (!result.startsWith('data:')) {
            img.crossOrigin = "anonymous";
        }

        img.src = result;

        img.onload = async () => {
            console.log("Main image loaded for download.");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // 1. Draw Base Image
            ctx.drawImage(img, 0, 0);

            const padding = canvas.width * 0.03;
            const logoOpacity = 0.5; // "Light" watermark

            // Helper to load image
            const loadImage = (src: string): Promise<HTMLImageElement | null> => {
                return new Promise((resolve) => {
                    const i = new Image();
                    if (!src.startsWith('data:')) i.crossOrigin = "anonymous";
                    i.src = src;
                    i.onload = () => resolve(i);
                    i.onerror = () => {
                        console.warn(`Failed to load watermark: ${src}`);
                        resolve(null);
                    };
                });
            };

            // 2. Load Watermark Images
            const railifyLogoUrl = '/logo.png';
            const tenantLogoUrl = watermarkLogo || logo;

            const [railifyImg, tenantImg] = await Promise.all([
                loadImage(railifyLogoUrl),
                tenantLogoUrl ? loadImage(tenantLogoUrl as string) : Promise.resolve(null)
            ]);

            // 3. Draw Railify Logo (Bottom-Left)
            if (railifyImg) {
                const logoSize = Math.max(canvas.width * 0.15, 100);
                const imgW = railifyImg.width || 300;
                const imgH = railifyImg.height || 300;
                const aspectRatio = imgW / imgH;
                const drawWidth = logoSize;
                const drawHeight = logoSize / aspectRatio;

                ctx.globalAlpha = logoOpacity;
                // Bottom-Left
                ctx.drawImage(railifyImg, padding, canvas.height - drawHeight - padding, drawWidth, drawHeight);
                ctx.globalAlpha = 1.0;
            } else {
                // Fallback text for Railify if image missing (unlikely)
                ctx.font = `bold ${canvas.width * 0.02}px monospace`;
                ctx.fillStyle = `rgba(255, 255, 255, ${logoOpacity})`;
                ctx.textAlign = 'left';
                ctx.fillText('RAILIFY', padding, canvas.height - padding);
            }

            // 4. Draw Tenant Logo (Bottom-Right)
            if (tenantImg) {
                const logoSize = Math.max(canvas.width * 0.15, 100);
                const imgW = tenantImg.width || 300;
                const imgH = tenantImg.height || 300;
                const aspectRatio = imgW / imgH;
                const drawWidth = logoSize;
                const drawHeight = logoSize / aspectRatio;

                ctx.globalAlpha = logoOpacity;
                // Bottom-Right
                ctx.drawImage(tenantImg, canvas.width - drawWidth - padding, canvas.height - drawHeight - padding, drawWidth, drawHeight);
                ctx.globalAlpha = 1.0;
            }

            downloadCanvas(canvas, img);
        };

        img.onerror = (e) => {
            console.error("Failed to load main image for download canvas:", e);
            alert("Could not prepare image for download. Please try right-clicking the image to save.");
        };
    };

    const downloadCanvas = (canvas: HTMLCanvasElement, mainImg?: HTMLImageElement) => {
        let finalDataUrl = '';
        try {
            finalDataUrl = canvas.toDataURL('image/png');
        } catch (e) {
            console.warn("Canvas tainted by watermark. Falling back to non-watermarked image.", e);
            if (mainImg) {
                // Fallback: Create simple canvas with just the main image
                const simpleCanvas = document.createElement('canvas');
                simpleCanvas.width = mainImg.width;
                simpleCanvas.height = mainImg.height;
                const ctx = simpleCanvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(mainImg, 0, 0);
                    try {
                        finalDataUrl = simpleCanvas.toDataURL('image/png');
                    } catch (e2) {
                        console.error("Even main image tainted canvas (unlikely for Base64).", e2);
                    }
                }
            }
        }

        if (!finalDataUrl) {
            alert("Security policy blocked image processing. Please right-click the preview to save.");
            return;
        }

        // Set URL and Show Modal (100% Reliability for Embeds)
        setDownloadUrl(finalDataUrl);
        setShowDownloadModal(true);

        // Optional: Still try to auto-trigger for desktop users who tolerate it
        // But only if NOT in an iframe to avoid confusion
        const isIframe = window.self !== window.top;
        if (!isIframe) {
            try {
                const link = document.createElement('a');
                link.download = `Railify-${Date.now()}.png`;
                link.href = finalDataUrl;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (e) {
                console.warn("Auto-download suppressed, modal should handle it.");
            }
        }
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
            className="fixed inset-0 z-50 text-white flex flex-col font-sans selection:bg-[var(--primary)] selection:text-black overflow-hidden"
            style={{
                backgroundColor: toolBackgroundColor,
                // @ts-ignore
                '--primary': primaryColor,
                '--primary-rgb': primaryRgb
            }}
        >
            {/* Header */}
            <header className="absolute top-0 left-0 right-0 z-50 p-6 flex justify-between items-center pointer-events-none">
                {/* Disclaimer */}
                <div className="text-[10px] md:text-xs text-white/30 font-mono uppercase tracking-widest select-none">
                    AI Visualization · Results May Vary
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

            {/* Admin Back Button */}
            {dashboardUrl && (
                <div className="absolute top-6 left-6 z-[60]">
                    <a
                        href={dashboardUrl}
                        className="bg-black/50 hover:bg-black/80 text-white backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all hover:pr-6 group"
                    >
                        <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                        Back to Dashboard
                    </a>
                </div>
            )}

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
                            className="w-full h-full flex flex-col items-center justify-center p-6 min-h-0"
                        >
                            <div className="max-w-xl w-full text-center space-y-6">
                                <div className="space-y-2">
                                    <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter">
                                        Transform Your <span className="text-[var(--primary)]">Space</span>
                                    </h2>
                                    <p className="text-gray-400 text-sm md:text-base max-w-sm mx-auto leading-relaxed">
                                        Upload a photo of your staircase to instantly visualize premium handrail designs.
                                    </p>
                                </div>

                                <div className="relative group w-full aspect-video bg-[#0A0A0A] rounded-3xl border border-[#222] shadow-2xl hover:border-[var(--primary)] transition-all duration-300 flex flex-col items-center justify-center cursor-pointer hover:bg-[#0e0e0e] hover:shadow-[0_0_30px_-5px_var(--primary-rgb)] overflow-hidden">
                                    <input type="file" onChange={handleFileChange} className="absolute inset-0 z-20 opacity-0 cursor-pointer" accept="image/*, .heic, .heif" />
                                    <div className="w-12 h-12 bg-[#151515] rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <Upload className="w-6 h-6 text-[var(--primary)]" />
                                    </div>
                                    <p className="text-lg font-bold uppercase tracking-widest mb-1">Upload Photo</p>
                                    <p className="text-[10px] text-gray-500 font-mono">JPG, PNG, HEIC (Max 10MB)</p>

                                    {/* Processing Overlay */}
                                    {isProcessing && (
                                        <div className="absolute inset-0 z-30 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
                                            <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mb-4" />
                                            <p className="text-white font-bold tracking-wider animate-pulse text-xs">PROCESSING...</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}


                    {/* STEP 2: VISUALIZE */}
                    {step === 2 && (
                        <motion.section
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="w-full h-full flex flex-col p-4 md:p-8"
                        >
                            <div className="flex flex-col md:grid md:grid-cols-2 gap-6 h-full min-h-0">
                                {/* Left: Preview */}
                                <div className="relative w-full flex-1 md:h-full bg-[#111] border border-white/10 rounded-2xl overflow-hidden flex items-center justify-center p-4 shadow-2xl group min-h-0 order-1">
                                    {/* Back Button */}
                                    <div className="absolute top-4 left-4 z-20">
                                        <button
                                            onClick={() => setStep(1)}
                                            className="p-2 bg-black/50 hover:bg-black/80 backdrop-blur-md rounded-lg text-white/50 hover:text-white transition-colors border border-white/10"
                                        >
                                            <ChevronLeft size={20} />
                                        </button>
                                    </div>

                                    {preview && (
                                        <img
                                            src={preview}
                                            alt="Original"
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    )}
                                    <div className="absolute bottom-4 right-4 text-[10px] font-mono text-gray-500 bg-black/50 px-2 py-1 rounded hidden md:block">
                                        ORIGINAL
                                    </div>
                                </div>

                                {/* Right: Controls */}
                                <div className="flex flex-col h-auto md:h-full min-h-0 relative order-2">

                                    {/* Carousel Section (Visible on ALL screens now) */}
                                    <div className="flex flex-col h-auto md:h-full justify-end md:justify-center min-h-0 flex-none pb-4 md:pb-0">
                                        <h3 className="text-xl md:text-2xl font-black uppercase tracking-tighter mb-2 md:mb-4">Select Style</h3>

                                        {/* Carousel - Center Mode with Neighbors */}
                                        <div className="relative w-full h-64 md:h-80 flex items-center justify-center mb-6 perspective-[1000px] group select-none">

                                            {/* PREVIOUS Image (Left) */}
                                            <div
                                                className="absolute left-[-5%] w-[60%] h-[80%] opacity-40 blur-[1px] scale-90 z-0 cursor-pointer transition-all duration-300 hover:opacity-60 hover:scale-95"
                                                onClick={() => setSelectedStyleIndex((prev) => (prev - 1 + styleList.length) % styleList.length)}
                                            >
                                                <img
                                                    src={styleList[(selectedStyleIndex - 1 + styleList.length) % styleList.length].image_url || '/styles/industrial.png'}
                                                    className="w-full h-full object-cover rounded-xl grayscale"
                                                />
                                            </div>

                                            {/* NEXT Image (Right) */}
                                            <div
                                                className="absolute right-[-5%] w-[60%] h-[80%] opacity-40 blur-[1px] scale-90 z-0 cursor-pointer transition-all duration-300 hover:opacity-60 hover:scale-95"
                                                onClick={() => setSelectedStyleIndex((prev) => (prev + 1) % styleList.length)}
                                            >
                                                <img
                                                    src={styleList[(selectedStyleIndex + 1) % styleList.length].image_url || '/styles/industrial.png'}
                                                    className="w-full h-full object-cover rounded-xl grayscale"
                                                />
                                            </div>

                                            {/* ACTIVE Image (Center) */}
                                            <div className="relative z-20 w-[70%] h-full shadow-2xl rounded-2xl overflow-hidden border-2 border-[var(--primary)] bg-[#111]">
                                                <AnimatePresence mode='popLayout' custom={direction}>
                                                    <motion.img
                                                        key={styleList[selectedStyleIndex].id}
                                                        src={styleList[selectedStyleIndex].image_url || '/styles/industrial.png'}
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        exit={{ opacity: 0, scale: 0.9 }}
                                                        transition={{ duration: 0.3 }}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </AnimatePresence>

                                                {/* Overlay Text */}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-end p-6">
                                                    <h4 className="text-white text-2xl md:text-3xl font-black uppercase italic tracking-tighter shadow-black drop-shadow-lg">
                                                        {styleList[selectedStyleIndex].name}
                                                    </h4>
                                                    <p className="text-gray-300 text-xs line-clamp-2 md:line-clamp-3 leading-relaxed shadow-black drop-shadow-md">
                                                        {styleList[selectedStyleIndex].description}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Arrows - Integrated */}
                                            <button
                                                onClick={() => setSelectedStyleIndex((prev) => (prev - 1 + styleList.length) % styleList.length)}
                                                className="absolute left-2 top-1/2 -translate-y-1/2 z-30 bg-black/50 hover:bg-[var(--primary)] text-white hover:text-black p-3 rounded-full backdrop-blur-md transition-all active:scale-90"
                                            >
                                                <ChevronLeft className="w-6 h-6" />
                                            </button>
                                            <button
                                                onClick={() => setSelectedStyleIndex((prev) => (prev + 1) % styleList.length)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 z-30 bg-black/50 hover:bg-[var(--primary)] text-white hover:text-black p-3 rounded-full backdrop-blur-md transition-all active:scale-90"
                                            >
                                                <ChevronRight className="w-6 h-6" />
                                            </button>
                                        </div>

                                        <button
                                            onClick={handleGenerate}
                                            disabled={isGenerating}
                                            className="w-full py-4 bg-[var(--primary)] text-black font-bold text-lg uppercase tracking-wider hover:brightness-110 transition-all shadow-[0_0_20px_-5px_var(--primary)] rounded-xl flex items-center justify-center gap-2"
                                        >
                                            {isGenerating ? <Loader2 className="animate-spin" /> : <TrendingUp size={20} />}
                                            Generate
                                        </button>

                                        {/* Debug Error Display */}
                                        {error && (
                                            <div className="mt-4 p-4 bg-red-900/50 border border-red-500/50 rounded-xl text-red-200 text-sm font-mono break-words">
                                                <div className="flex items-center gap-2 mb-2 font-bold text-red-400 uppercase tracking-wider">
                                                    <AlertCircle size={16} />
                                                    Generation Failed
                                                </div>
                                                {error}
                                            </div>
                                        )}

                                    </div>
                                </div>
                            </div>

                            {/* LOADING OVERLAY */}
                            <AnimatePresence>
                                {isGenerating && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="fixed inset-0 bg-black/90 z-[60] flex flex-col items-center justify-center p-8 backdrop-blur-sm"
                                    >
                                        <div className="w-24 h-24 border-4 border-[var(--secondary)] border-t-[var(--primary)] rounded-full animate-spin mb-8" />
                                        <h3 className="text-2xl font-bold text-white mb-2 uppercase">Rendering</h3>
                                        <p className="text-[var(--primary)] animate-pulse font-mono text-sm">AI Processing...</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
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
                            className="w-full h-full flex items-center justify-center"
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
                                    <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden p-8">
                                        {result && (
                                            <img
                                                src={result}
                                                className="w-full h-full object-contain max-h-[60vh] rounded-3xl border border-[#333] shadow-2xl"
                                            />
                                        )}

                                        {/* Dynamic Watermark - Adjusted position for new borders */}
                                        {(watermarkLogo || logo) && result && (
                                            <img src={watermarkLogo || logo as string} className="absolute bottom-10 right-10 w-24 md:w-32 opacity-80 drop-shadow-lg" />
                                        )}
                                    </div>

                                    {/* Action Bar */}
                                    <div className="bg-[#0A0A0A] border-t border-[#222] p-4 flex flex-wrap justify-center items-center gap-4">

                                        {/* Navigation Controls moved here */}
                                        <div className="flex gap-2">
                                            <button onClick={() => paginate(-1)} className="bg-[#222] text-white px-4 py-3 rounded-xl border border-white/5 hover:bg-white hover:text-black transition-all flex items-center gap-2 text-xs uppercase font-bold tracking-widest">
                                                <ChevronLeft className="w-4 h-4" /> Back
                                            </button>
                                            <button onClick={() => { setFile(null); setPreview(null); setResult(null); setStep(1); }} className="bg-[#222] text-white px-4 py-3 rounded-xl border border-white/5 hover:bg-red-500 hover:text-white transition-all flex items-center gap-2 text-xs uppercase font-bold tracking-widest">
                                                <RefreshCw className="w-4 h-4" /> Restart
                                            </button>
                                        </div>

                                        <div className="h-8 w-px bg-[#333] hidden md:block"></div>

                                        {/* Show Request Quote ONLY if Pricing is NOT available (fallback). 
                                            If Pricing IS available, users should go through Estimate -> Quote flow. 
                                        */}
                                        {!(styleList[selectedStyleIndex]?.price_per_ft_min && styleList[selectedStyleIndex]?.price_per_ft_min > 0) && (
                                            <button onClick={() => setQuoteOpen(true)} className="px-6 py-3 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-colors text-xs md:text-sm cursor-pointer shadow-lg">
                                                Request Quote
                                            </button>
                                        )}

                                        {(styleList[selectedStyleIndex]?.price_per_ft_min || 0) > 0 && (
                                            <button onClick={() => setShowEstimate(true)} className="px-6 py-3 bg-blue-600 text-white font-black uppercase tracking-widest rounded-xl hover:bg-blue-500 transition-colors text-xs md:text-sm cursor-pointer shadow-lg flex items-center gap-2">
                                                <TrendingUp size={16} /> Estimate
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>

            {/* Footer Branding */}
            <div className="fixed bottom-4 right-4 z-40 pointer-events-none opacity-30 text-[10px] font-mono text-white uppercase tracking-widest hidden md:block">
                Software by Railify
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
                            className="bg-[#111] border border-[#333] p-8 rounded-2xl max-w-md w-full relative shadow-2xl max-h-[85vh] overflow-y-auto"
                        >
                            <button onClick={() => setQuoteOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white sticky z-10"><X /></button>

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
                                    <div className="space-y-1">
                                        <label className="text-xs font-mono text-gray-500 uppercase">Photos (Optional)</label>
                                        <div className="border border-[#333] border-dashed rounded p-4 text-center cursor-pointer hover:bg-white/5 transition-colors relative">
                                            <input
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                onChange={e => setQuoteFiles(Array.from(e.target.files || []))}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                            <div className="flex flex-col items-center gap-2 text-gray-400">
                                                <Upload size={20} />
                                                <span className="text-xs">{quoteFiles.length > 0 ? `${quoteFiles.length} file(s) selected` : 'Upload photos of your space'}</span>
                                            </div>
                                        </div>
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

            <EstimateModal
                isOpen={showEstimate}
                onClose={() => setShowEstimate(false)}
                styleId={styleList[selectedStyleIndex]?.id}
                styleName={styleList[selectedStyleIndex]?.name}
                onRequestQuote={(estimateData: any) => {
                    setShowEstimate(false);
                    setQuoteOpen(true);
                    setCurrentEstimate(estimateData); // Save for submission
                    setMessage(`I received an estimate of ${estimateData.min} - ${estimateData.max} for ${estimateData.linearFeet}ft of ${styleList[selectedStyleIndex]?.name}. (Zip: ${estimateData.zipCode})`);
                }}
            />
            {/* Manual Download Fallback Modal */}
            <AnimatePresence>
                {showDownloadModal && downloadUrl && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            className="bg-[#111] border border-[#333] p-8 rounded-2xl max-w-sm w-full relative shadow-2xl text-center"
                        >
                            <button onClick={() => setShowDownloadModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X /></button>

                            <Check className="w-16 h-16 text-[var(--primary)] mx-auto mb-4" />
                            <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Design Ready</h2>
                            <p className="text-gray-400 text-sm mb-6">Your customized handrail design has been generated.</p>

                            <a
                                href={downloadUrl}
                                download={`Railify-Design-${Date.now()}.png`}
                                onClick={() => setTimeout(() => setShowDownloadModal(false), 1000)}
                                className="block w-full py-4 bg-[var(--primary)] text-black font-bold uppercase tracking-widest rounded hover:brightness-110 transition-colors shadow-[0_0_20px_-5px_var(--primary)] text-center text-decoration-none"
                            >
                                Save Image
                            </a>
                            <p className="text-[10px] text-gray-600 mt-4 uppercase tracking-widest">Click to Download</p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}
