import clsx from 'clsx';
import { Upload, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { compressImage } from '@/utils/imageUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { useRef, useEffect } from 'react';

export default function StyleControls({
    styleSource,
    setStyleSource,
    styles,
    selectedStyleIndex,
    setSelectedStyleIndex,
    customStyleFile,
    setCustomStyleFile,
    error,

}: {
    styleSource: 'preset' | 'upload',
    setStyleSource: (s: 'preset' | 'upload') => void,
    styles: any[],
    selectedStyleIndex: number,
    setSelectedStyleIndex: (i: number) => void,
    customStyleFile: File | null,
    setCustomStyleFile: (f: File | null) => void,
    error: string | null,

}) {
    const handleStyleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const compressed = await compressImage(e.target.files[0]);
                setCustomStyleFile(compressed);
            } catch (err) {
                console.error("Style compression failed", err);
            }
        }
    };

    const carouselRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to selected item
    useEffect(() => {
        if (carouselRef.current && styles.length > 0) {
            const selectedElement = carouselRef.current.children[selectedStyleIndex] as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [selectedStyleIndex]);

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Toggle Source */}
            <div className="flex bg-[#111] p-1 rounded-full border border-white/10 mb-6 shrink-0 relative">
                {/* Sliding Background for Toggle could be added here for extra polish, but simple buttons work well too */}
                <button
                    onClick={() => setStyleSource('preset')}
                    className={clsx(
                        "flex-1 py-3 px-4 rounded-full text-xs font-bold uppercase tracking-wider transition-all relative z-10",
                        styleSource === 'preset'
                            ? "bg-[var(--primary)] text-black shadow-lg"
                            : "text-gray-400 hover:text-white"
                    )}
                >
                    Gallery
                </button>
                <button
                    onClick={() => setStyleSource('upload')}
                    className={clsx(
                        "flex-1 py-3 px-4 rounded-full text-xs font-bold uppercase tracking-wider transition-all relative z-10",
                        styleSource === 'upload'
                            ? "bg-[var(--primary)] text-black shadow-lg"
                            : "text-gray-400 hover:text-white"
                    )}
                >
                    Custom Upload
                </button>
            </div>

            {styleSource === 'preset' ? (
                <div className="flex-1 min-h-0 flex flex-col relative">
                    {/* Gradient Masks for Scroll Hint */}
                    <div className="absolute top-0 bottom-0 left-0 w-8 z-10 bg-gradient-to-r from-black via-black/50 to-transparent pointer-events-none" />
                    <div className="absolute top-0 bottom-0 right-0 w-8 z-10 bg-gradient-to-l from-black via-black/50 to-transparent pointer-events-none" />

                    <div
                        ref={carouselRef}
                        className="flex-1 overflow-x-auto flex gap-4 items-center pb-4 px-4 snap-x snap-mandatory scrollbar-hide"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        {styles.map((style, index) => (
                            <motion.div
                                key={style.id}
                                onClick={() => setSelectedStyleIndex(index)}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{
                                    opacity: 1,
                                    scale: selectedStyleIndex === index ? 1.05 : 1,
                                    borderColor: selectedStyleIndex === index ? 'var(--primary)' : 'rgba(255,255,255,0.1)'
                                }}
                                className={clsx(
                                    "relative shrink-0 w-[45vw] md:w-[200px] aspect-[3/4] rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-300 snap-center group shadow-xl",
                                    selectedStyleIndex === index ? "shadow-[0_0_20px_-5px_var(--primary)]" : "opacity-60 hover:opacity-100"
                                )}
                            >
                                <img
                                    src={style.image_url || '/styles/industrial.png'}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    alt={style.name}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent p-4 flex flex-col justify-end">
                                    <h3 className={clsx(
                                        "font-black uppercase text-sm md:text-base leading-tight mb-1",
                                        selectedStyleIndex === index ? "text-[var(--primary)]" : "text-white"
                                    )}>
                                        {style.name}
                                    </h3>
                                    {selectedStyleIndex === index && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="text-[10px] text-gray-300 line-clamp-2"
                                        >
                                            {style.description}
                                        </motion.div>
                                    )}
                                </div>

                                {selectedStyleIndex === index && (
                                    <div className="absolute top-3 right-3 bg-[var(--primary)] text-black rounded-full p-1 shadow-lg">
                                        <Check size={12} strokeWidth={4} />
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>

                    {/* Navigation Arrows (Optional, mostly for desktop but helper on mobile) */}
                    <div className="flex justify-center gap-4 mt-2 mb-2">
                        <button
                            onClick={() => {
                                const newIndex = (selectedStyleIndex - 1 + styles.length) % styles.length;
                                setSelectedStyleIndex(newIndex);
                            }}
                            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div className="text-[10px] font-mono text-gray-500 uppercase flex items-center">
                            {selectedStyleIndex + 1} / {styles.length}
                        </div>
                        <button
                            onClick={() => {
                                const newIndex = (selectedStyleIndex + 1) % styles.length;
                                setSelectedStyleIndex(newIndex);
                            }}
                            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-4 border border-dashed border-gray-700 rounded-xl bg-[#111] text-center relative overflow-hidden group">
                    {customStyleFile ? (
                        <div className="relative w-full h-full flex items-center justify-center">
                            <img
                                src={URL.createObjectURL(customStyleFile)}
                                alt="Style Reference"
                                className="max-w-full max-h-[300px] rounded-lg shadow-2xl"
                            />
                            <button
                                onClick={() => setCustomStyleFile(null)}
                                className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold uppercase tracking-wider"
                            >
                                Remove Image
                            </button>
                        </div>
                    ) : (
                        <div className="py-8">
                            <div className="w-16 h-16 mx-auto bg-gray-900 rounded-full flex items-center justify-center mb-4 text-[var(--primary)] group-hover:scale-110 transition-transform">
                                <Upload className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Upload Reference</h3>
                            <p className="text-gray-500 mb-6 max-w-[200px] mx-auto text-xs">
                                Use your own photo as a style guide.
                            </p>
                            <label className="inline-flex items-center gap-2 cursor-pointer px-6 py-3 rounded-lg bg-[var(--primary)] text-black font-bold hover:brightness-110 transition-all shadow-[0_0_15px_-5px_var(--primary)]">
                                <span>Select Image</span>
                                <input
                                    type="file"
                                    onChange={handleStyleUpload}
                                    className="hidden"
                                    accept=".jpg,.jpeg,.png,.webp,.heic"
                                />
                            </label>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
