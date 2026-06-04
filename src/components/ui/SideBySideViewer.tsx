import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import { useState } from 'react';

interface SideBySideViewerProps {
    isOpen: boolean;
    onClose: () => void;
    originalImage: string | null;
    generatedImage: string | null;
}

export function SideBySideViewer({ isOpen, onClose, originalImage, generatedImage }: SideBySideViewerProps) {
    const [viewMode, setViewMode] = useState<'split' | 'original' | 'generated'>('split');

    if (!isOpen || !originalImage || !generatedImage) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) onClose();
                    }}
                >
                    {/* Header */}
                    <div className="flex justify-between items-center p-6 border-b border-white/10 relative z-10 w-full bg-black/20">
                        <div className="flex gap-4">
                            <button
                                onClick={() => setViewMode('split')}
                                className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-all border ${viewMode === 'split' ? 'bg-white text-black border-white' : 'bg-transparent text-gray-500 border-transparent hover:text-white'}`}
                            >
                                Side-by-Side
                            </button>
                            <button
                                onClick={() => setViewMode('original')}
                                className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-all border ${viewMode === 'original' ? 'bg-white text-black border-white' : 'bg-transparent text-gray-500 border-transparent hover:text-white'}`}
                            >
                                Original
                            </button>
                            <button
                                onClick={() => setViewMode('generated')}
                                className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-all border ${viewMode === 'generated' ? 'bg-white text-black border-white' : 'bg-transparent text-gray-500 border-transparent hover:text-white'}`}
                            >
                                Generated
                            </button>
                        </div>

                        <button
                            onClick={onClose}
                            className="bg-white/10 hover:bg-white text-white hover:text-black p-2 rounded-full transition-all"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden relative">
                        {viewMode === 'split' && (
                            <div className="flex flex-col md:flex-row gap-4 w-full h-full max-w-7xl mx-auto">
                                <div className="flex-1 relative rounded-2xl overflow-hidden border border-white/10 bg-black group">
                                    <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur px-3 py-1 rounded text-[10px] font-mono uppercase text-gray-400">Original</div>
                                    <img src={originalImage} className="w-full h-full object-contain" alt="Original" />
                                </div>
                                <div className="flex-1 relative rounded-2xl overflow-hidden border border-[var(--primary)] shadow-[0_0_30px_-10px_var(--primary)] bg-black group">
                                    <div className="absolute top-4 left-4 z-10 bg-[var(--primary)] text-black px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider">Generated</div>
                                    <img src={generatedImage} className="w-full h-full object-contain" alt="Generated" />
                                </div>
                            </div>
                        )}

                        {viewMode === 'original' && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="w-full h-full flex items-center justify-center p-4"
                            >
                                <img src={originalImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" alt="Original Full" />
                            </motion.div>
                        )}

                        {viewMode === 'generated' && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="w-full h-full flex items-center justify-center p-4"
                            >
                                <img src={generatedImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-[var(--primary)]" alt="Generated Full" />
                            </motion.div>
                        )}
                    </div>

                    {/* Footer Hint */}
                    <div className="text-center pb-6 text-gray-500 text-xs uppercase tracking-widest font-mono pointer-events-none">
                        {viewMode === 'split' ? 'Compare Results' : 'Full Screen View'}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
