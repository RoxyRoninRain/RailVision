'use client';

import { useState, useEffect } from 'react';
import { PortfolioItem, createStyle, deleteStyle, seedDefaultStyles, updateStyleStatus, convertHeicToJpg } from '@/app/actions'; // Ensure these are exported from actions.ts
import { Plus, Trash2, Loader2, Image as ImageIcon, X, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function StylesManager({ initialStyles, serverError, logoUrl }: { initialStyles: PortfolioItem[], serverError?: string | null, logoUrl?: string | null }) {
    const [styles, setStyles] = useState<PortfolioItem[]>(initialStyles);
    const [isAdding, setIsAdding] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Form State
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');

    const [newFiles, setNewFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);


    // Auto-Seed Defaults
    useEffect(() => {
        if (initialStyles.length === 0) {
            console.log('No styles found. Seeding defaults...');
            seedDefaultStyles().then(res => {
                if (res.success && res.seeded) {
                    window.location.reload();
                }
            });
        }
    }, [initialStyles.length]);

    // Image Compression Helper
    const compressImage = async (file: File, maxDim = 1500, quality = 0.85): Promise<File> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Maintain aspect ratio
                if (width > height) {
                    if (width > maxDim) {
                        height *= maxDim / width;
                        width = maxDim;
                    }
                } else {
                    if (height > maxDim) {
                        width *= maxDim / height;
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Compression failed'));
                        return;
                    }
                    const newFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });
                    resolve(newFile);
                }, 'image/jpeg', quality);
            };
            img.onerror = (err) => reject(err);
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setErrorMsg(null);
        if (!e.target.files || e.target.files.length === 0) return;

        setIsProcessing(true);
        // Don't clear previous files immediately if we want to support adding? 
        // For simplicity, let's Replace the list on new selection, or Append?
        // User probably expects "Select Files" to replace.
        // Let's support clearing via UI later. For now, replace.
        setNewFiles([]);
        setPreviews([]);

        const selectedFiles = Array.from(e.target.files);
        const processedFiles: File[] = [];
        const processedPreviews: string[] = [];

        try {
            for (let file of selectedFiles) {
                // DEBUG LOGGING
                console.log(`--- PROCESSING FILE: ${file.name} ---`);

                // Fix: iOS/Mobile missing type
                const validExtensions = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
                const ext = file.name.split('.').pop()?.toLowerCase() || '';

                if (!file.type.startsWith('image/') && !validExtensions.includes(ext)) {
                    console.log(`Skipping Invalid File: ${file.name}`);
                    continue; // Skip invalid
                }

                if (!file.type && validExtensions.includes(ext)) {
                    const fixedType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
                    file = new File([file.slice(0, file.size, fixedType)], file.name, { type: fixedType, lastModified: Date.now() });
                }

                // HEIC Conversion
                const isHeic = file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic' || file.type === 'image/heif';
                if (isHeic) {
                    try {
                        const formData = new FormData();
                        formData.append('file', file);
                        const res = await convertHeicToJpg(formData);
                        if (res.success && res.base64) {
                            const base64Data = res.base64.split(',')[1];
                            const byteCharacters = atob(base64Data);
                            const byteArrays = [];
                            for (let offset = 0; offset < byteCharacters.length; offset += 512) {
                                const slice = byteCharacters.slice(offset, offset + 512);
                                const byteNumbers = new Array(slice.length);
                                for (let i = 0; i < slice.length; i++) {
                                    byteNumbers[i] = slice.charCodeAt(i);
                                }
                                byteArrays.push(new Uint8Array(byteNumbers));
                            }
                            const blob = new Blob(byteArrays, { type: 'image/jpeg' });
                            file = new File([blob], file.name.replace(/\.(heic|HEIC|heif|HEIF)$/i, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() });
                        }
                    } catch (err) {
                        console.error('HEIC Error', err);
                    }
                }

                // Compression
                try {
                    if (file.size > 1 * 1024 * 1024) { // 1MB threshold
                        const compressed = await compressImage(file, 1500, 0.85);
                        if (compressed.size < file.size) file = compressed;
                    }
                } catch (err) {
                    console.error('Compression Error', err);
                }

                if (file.size > 4.5 * 1024 * 1024) {
                    alert(`File ${file.name} is too large (>4.5MB). Skipping.`);
                    continue;
                }

                processedFiles.push(file);
                processedPreviews.push(URL.createObjectURL(file));
            }

            if (processedFiles.length === 0) {
                setErrorMsg('No valid images selected.');
                return;
            }

            setNewFiles(processedFiles);
            setPreviews(processedPreviews);

        } catch (err: any) {
            console.error('File processing error:', err);
            setErrorMsg(err.message || 'Failed to process images');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);

        // DEBUG LOGGING FOR SUBMIT
        if (newFiles.length === 0 || !newName) {
            const missing = [];
            if (newFiles.length === 0) missing.push('File(s)');
            if (!newName) missing.push('Name');
            const msg = `Please provide: ${missing.join(' and ')}`;
            setErrorMsg(msg);
            return;
        }

        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('name', newName);
        formData.append('description', newDesc);

        // Append all files
        newFiles.forEach(file => {
            formData.append('files', file);
        });

        try {
            const res = await createStyle(formData);

            if (res.error) {
                console.error('Create Style Error:', res.error);
                console.log(`Server returned error: ${res.error}`);
                setErrorMsg(res.error);
                setIsSubmitting(false);
            } else {
                console.log('Upload Success! Reloading...');
                setSuccessMsg('Style created successfully! updating...');
                // Slight delay so user sees success message
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
        } catch (err: any) {
            console.log(`Exception: ${err.message}`);
            setErrorMsg('Unexpected error: ' + (err.message || String(err)));
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this style?')) return;

        // Optimistic update
        setStyles(prev => prev.filter(s => s.id !== id));

        const res = await deleteStyle(id);
        if (res.error) {
            alert('Failed to delete: ' + res.error);
            // Revert? simpler to just reload or ignore for MVP
            window.location.reload();
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        // Optimistic
        setStyles(prev => prev.map(s => s.id === id ? { ...s, is_active: !currentStatus } : s));

        await updateStyleStatus(id, !currentStatus);
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-white">Visualizer Styles</h2>
                    <p className="text-gray-500 font-mono text-sm mt-1">Manage the styles available in your public visualizer carousel.</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 bg-[var(--primary)] text-black px-4 py-2 rounded font-bold uppercase tracking-wider hover:brightness-110 transition-colors"
                >
                    <Plus size={18} /> Add New Style
                </button>
            </div>

            {serverError && (
                <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200 mb-6">
                    <p className="font-bold flex items-center gap-2">⚠️ System Error: Unable to load styles</p>
                    <p className="text-sm font-mono mt-1 opacity-80">{serverError}</p>
                    <p className="text-xs mt-2">Please run the "Force Fix" SQL script in your Supabase Dashboard.</p>
                </div>
            )}

            {/* Grid - Change to Masonry-like columns or just responsive heights */}


            <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
                {styles.length === 0 && !isAdding && (
                    <div className="col-span-full text-center py-12 border border-dashed border-gray-800 rounded-xl bg-white/5">
                        <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ImageIcon className="text-gray-600" />
                        </div>
                        <h3 className="text-white font-bold uppercase mb-2">No Custom Styles</h3>
                        <p className="text-gray-500 text-sm">Upload your first style to get started.</p>
                    </div>
                )}

                <AnimatePresence>
                    {styles.map(style => (
                        <motion.div
                            key={style.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className={`group relative bg-[#111] rounded-xl overflow-hidden border transition-colors break-inside-avoid mb-6 ${style.is_active === false ? 'border-red-900/50 opacity-60' : 'border-[#222] hover:border-[var(--primary)]'}`}
                        >
                            {/* Use object-contain with background for varying aspect ratios */}
                            <div className="w-full bg-black/50 flex items-center justify-center p-2 min-h-[200px]">
                                <img
                                    src={style.image_url}
                                    alt={style.name}
                                    className="max-w-full max-h-[500px] w-auto h-auto object-contain rounded-lg shadow-lg"
                                />
                                {logoUrl && (
                                    <img
                                        src={logoUrl}
                                        className="absolute bottom-4 right-4 w-1/4 max-w-[80px] opacity-70 pointer-events-none drop-shadow-md"
                                        alt="Watermark"
                                    />
                                )}
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-6 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                <h4 className="text-xl font-bold text-white uppercase">{style.name}</h4>
                                <div className="flex items-center gap-2 mb-4">
                                    <p className="text-gray-400 text-xs line-clamp-2 flex-grow">{style.description}</p>

                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleToggleStatus(style.id, style.is_active !== false); }}
                                    className="flex items-center gap-2 text-white/80 hover:text-white text-xs uppercase font-bold bg-black/50 px-3 py-2 rounded backdrop-blur-sm mb-2"
                                >
                                    {style.is_active !== false ? <Eye size={14} /> : <EyeOff size={14} className="text-gray-500" />}
                                    {style.is_active !== false ? 'Visible' : 'Hidden'}
                                </button>
                                <button
                                    onClick={() => handleDelete(style.id)}
                                    className="self-start flex items-center gap-2 text-red-400 hover:text-red-300 text-xs uppercase font-bold bg-black/50 px-3 py-2 rounded backdrop-blur-sm"
                                >
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Add Modal */}
            <AnimatePresence>
                {isAdding && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="bg-[#111] border border-[#333] w-full max-w-md p-6 rounded-2xl relative shadow-2xl"
                        >
                            <button onClick={() => setIsAdding(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                                <X size={20} />
                            </button>

                            <h3 className="text-xl font-bold text-white uppercase mb-6">Add New Style <span className="text-xs text-[var(--primary)] ml-2 border border-[var(--primary)] px-1 rounded">v2.1</span></h3>

                            {successMsg && (
                                <div className="mb-6 p-4 bg-green-900/40 border border-green-500/50 text-green-200 text-sm rounded-lg flex items-center gap-3">
                                    <div className="font-bold">✓ {successMsg}</div>
                                </div>
                            )}

                            {errorMsg && (
                                <div className="mb-6 p-4 bg-red-900/40 border border-red-500/50 text-red-200 text-sm rounded-lg flex items-start gap-3">
                                    <div className="shrink-0 pt-0.5">⚠️</div>
                                    <div>
                                        <div className="font-bold mb-1">Upload Failed</div>
                                        {errorMsg}
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-mono text-gray-500 uppercase mb-1">Style Name</label>
                                    <input
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        className="w-full bg-[#050505] border border-[#333] p-3 rounded text-white focus:border-[var(--primary)] outline-none"
                                        placeholder="e.g. Minimalist Noir"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-mono text-gray-500 uppercase mb-1">Description</label>
                                    <textarea
                                        value={newDesc}
                                        onChange={e => setNewDesc(e.target.value)}
                                        className="w-full bg-[#050505] border border-[#333] p-3 rounded text-white focus:border-[var(--primary)] outline-none h-20 resize-none"
                                        placeholder="Brief description of the aesthetic..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-mono text-gray-500 uppercase mb-1">Reference Images (Select 1-3)</label>
                                    <div className="relative border-2 border-dashed border-[#333] rounded-lg p-8 text-center hover:border-[var(--primary)] transition-colors cursor-pointer">
                                        <input
                                            type="file"
                                            onChange={handleFileChange}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            accept="image/*"
                                            multiple // Allow multiple
                                            required={newFiles.length === 0}
                                        />
                                        {previews.length > 0 ? (
                                            <div className="flex gap-2 justify-center flex-wrap">
                                                {previews.map((p, i) => (
                                                    <img key={i} src={p} className="h-20 w-20 object-cover rounded shadow" />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <ImageIcon className="w-8 h-8 text-gray-500 mx-auto" />
                                                <p className="text-xs text-gray-500">Click to upload multiple (JPG, PNG)</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    type="submit"

                                    disabled={isSubmitting || isProcessing || newFiles.length === 0}
                                    className={`w-full py-4 font-bold uppercase tracking-widest rounded transition-all mt-4 flex justify-center items-center gap-2 ${isSubmitting || isProcessing || newFiles.length === 0 ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-[var(--primary)] text-black hover:brightness-110'}`}
                                >
                                    {isProcessing ? <><Loader2 className="animate-spin" /> Processing Image...</> : (isSubmitting ? <Loader2 className="animate-spin" /> : 'Create Style')}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
