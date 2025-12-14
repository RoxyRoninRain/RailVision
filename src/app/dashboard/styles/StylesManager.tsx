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
    const [newFile, setNewFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => {
        console.log(msg);
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
    };

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
        if (!e.target.files || !e.target.files[0]) return;

        setIsProcessing(true);
        setNewFile(null); // Clear previous file

        try {
            let file = e.target.files[0];

            // DEBUG LOGGING
            addLog('--- FILE SELECTED ---');
            addLog(`Name: ${file.name}`);
            addLog(`Type: ${file.type || 'Unknown'}`);
            addLog(`Size: ${(file.size / 1024).toFixed(1)} KB`);

            // Fix: iOS sometimes sends empty type or application/octet-stream
            const validExtensions = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
            const ext = file.name.split('.').pop()?.toLowerCase() || '';

            if (!file.type.startsWith('image/') && !validExtensions.includes(ext)) {
                addLog(`File Rejected: Invalid Type (${file.type}) and Extension (${ext})`);
                setErrorMsg('Please upload an image file (JPG, PNG).');
                return;
            }

            // If type is empty but extension is valid, force type to prevent downstream issues
            if (!file.type && validExtensions.includes(ext)) {
                addLog('Fixing missing file type based on extension...');
                const fixedType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
                file = new File([file.slice(0, file.size, fixedType)], file.name, { type: fixedType, lastModified: Date.now() });
            }

            // HEIC Detection & Conversion (Server-Side)
            const isHeic = file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic' || file.type === 'image/heif';
            if (isHeic) {
                addLog('HEIC detected. Starting server-side conversion...');

                try {
                    const formData = new FormData();
                    formData.append('file', file);

                    const res = await convertHeicToJpg(formData);

                    if (res.success && res.base64) {
                        addLog('Server conversion successful. Processing result...');

                        // Convert Data URI to Blob directly
                        const base64Data = res.base64.split(',')[1];
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

                        file = new File([blob], file.name.replace(/\.(heic|HEIC|heif|HEIF)$/i, '.jpg'), {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });

                        addLog(`HEIC Converted Successfully. New Size: ${(file.size / 1024).toFixed(1)} KB`);

                    } else {
                        throw new Error(res.error || "Server conversion returned no data");
                    }

                } catch (heicError: any) {
                    console.error('HEIC Conversion failed:', heicError);
                    addLog(`HEIC Error: ${heicError.message}`);
                    throw new Error('Could not convert HEIC image. Please try a JPG or PNG instead.');
                }
            }

            // Iterative Compression Strategy
            try {
                // If file is > 4MB (safety margin for 4.5MB limit), strict compress
                // If file is > 1MB, moderate compress
                let currentFile = file;
                let attempt = 0;
                let maxDimension = 2000;
                let quality = 0.9;

                while (currentFile.size > 4 * 1024 * 1024 && attempt < 3) {
                    addLog(`Attempt ${attempt + 1}: Compressing ${(currentFile.size / 1024 / 1024).toFixed(2)}MB image...`);

                    // Progressive degradation
                    if (attempt === 1) { maxDimension = 1500; quality = 0.8; }
                    if (attempt === 2) { maxDimension = 1200; quality = 0.7; }

                    const compressed = await compressImage(currentFile, maxDimension, quality);

                    // Safety check: prevent infinite growth if compression fails or adds overhead
                    if (compressed.size < currentFile.size) {
                        currentFile = compressed;
                    } else {
                        // Compression didn't help (already optimized?), break to avoid loop
                        addLog('Compression did not reduce file size.');
                        break;
                    }
                    attempt++;
                }

                file = currentFile;
                addLog(`Final File Size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

            } catch (err) {
                console.error('Compression failed:', err);
                if (file.size > 4.5 * 1024 * 1024) {
                    addLog('File Rejected: Compression failed & Too Large');
                    throw new Error('Image too large and compression failed.');
                }
            }

            // Final Safety Check
            if (file.size > 4.5 * 1024 * 1024) {
                addLog(`File Rejected: Still Too Large (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
                throw new Error(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 4.5MB.`);
            }

            setNewFile(file);
            setPreview(URL.createObjectURL(file));

        } catch (err: any) {
            console.error('File processing error:', err);
            addLog(`Error: ${err.message}`);
            setErrorMsg(err.message || 'Failed to process image');
            setNewFile(null); // Ensure no partial file is set
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);

        // DEBUG LOGGING FOR SUBMIT
        addLog(`Submitting Form... Name: "${newName}", File: ${newFile ? newFile.name : 'NULL'}`);

        if (!newFile || !newName) {
            const missing = [];
            if (!newFile) missing.push('File');
            if (!newName) missing.push('Name');
            const msg = `Please provide: ${missing.join(' and ')}`;
            addLog(`Validation Error: ${msg}`);
            setErrorMsg(msg);
            return;
        }

        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('name', newName);
        formData.append('description', newDesc);
        formData.append('file', newFile);

        try {
            const res = await createStyle(formData);

            if (res.error) {
                console.error('Create Style Error:', res.error);
                addLog(`Server returned error: ${res.error}`);
                setErrorMsg(res.error);
                setIsSubmitting(false);
            } else {
                addLog('Upload Success! Reloading...');
                setSuccessMsg('Style created successfully! updating...');
                // Slight delay so user sees success message
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
        } catch (err: any) {
            addLog(`Exception: ${err.message}`);
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
            {/* Debug Console */}
            <div className="bg-black/80 p-4 rounded-lg font-mono text-xs text-green-400 max-h-40 overflow-y-auto border border-green-900/50">
                <div className="text-gray-500 mb-2 border-b border-gray-800 pb-1">Debug Console (Share this if upload fails)</div>
                {logs.length === 0 && <div className="text-gray-600 italic">Ready...</div>}
                {logs.map((log, i) => (
                    <div key={i}>{log}</div>
                ))}
            </div>

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
                                <p className="text-gray-400 text-xs mb-4 line-clamp-2">{style.description}</p>
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
                                    <label className="block text-xs font-mono text-gray-500 uppercase mb-1">Reference Image</label>
                                    <div className="relative border-2 border-dashed border-[#333] rounded-lg p-8 text-center hover:border-[var(--primary)] transition-colors cursor-pointer">
                                        <input
                                            type="file"
                                            onChange={handleFileChange}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            accept="image/*"
                                            required
                                        />
                                        {preview ? (
                                            <img src={preview} className="mx-auto h-32 object-contain rounded" />
                                        ) : (
                                            <div className="space-y-2">
                                                <ImageIcon className="w-8 h-8 text-gray-500 mx-auto" />
                                                <p className="text-xs text-gray-500">Click to upload (JPG, PNG)</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting || isProcessing || !newFile}
                                    className={`w-full py-4 font-bold uppercase tracking-widest rounded transition-all mt-4 flex justify-center items-center gap-2 ${isSubmitting || isProcessing || !newFile ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-[var(--primary)] text-black hover:brightness-110'}`}
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
