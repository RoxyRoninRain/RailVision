'use client';

import { useState, useEffect } from 'react';
import { PortfolioItem, createStyle, deleteStyle, seedDefaultStyles, updateStyleStatus, convertHeicToJpg } from '@/app/actions'; // Ensure these are exported from actions.ts
import { Plus, Trash2, Loader2, Image as ImageIcon, X, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function StylesManager({ initialStyles, serverError, logoUrl }: { initialStyles: PortfolioItem[], serverError?: string | null, logoUrl?: string | null }) {
    const [styles, setStyles] = useState<PortfolioItem[]>(initialStyles);
    const [isAdding, setIsAdding] = useState(false);
    const [editingStyle, setEditingStyle] = useState<PortfolioItem | null>(null);
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
                                <div className="flex gap-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setEditingStyle(style); }}
                                        className="flex-1 flex items-center justify-center gap-2 text-black hover:bg-white text-xs uppercase font-bold bg-[var(--primary)] px-3 py-2 rounded backdrop-blur-sm mb-2"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleToggleStatus(style.id, style.is_active !== false); }}
                                        className="flex-1 flex items-center justify-center gap-2 text-white/80 hover:text-white text-xs uppercase font-bold bg-black/50 px-3 py-2 rounded backdrop-blur-sm mb-2"
                                    >
                                        {style.is_active !== false ? <Eye size={14} /> : <EyeOff size={14} className="text-gray-500" />}
                                        {style.is_active !== false ? 'Vis' : 'Hid'}
                                    </button>
                                </div>

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
                    <AddStyleModal onClose={() => setIsAdding(false)} onSuccess={() => window.location.reload()} />
                )}
            </AnimatePresence>

            {/* Edit Modal */}
            <AnimatePresence>
                {editingStyle && (
                    <EditStyleModal style={editingStyle} onClose={() => setEditingStyle(null)} onSuccess={() => window.location.reload()} />
                )}
            </AnimatePresence>
        </div>
    );
}

// --- SUB COMPONENTS ---

function AddStyleModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newFiles, setNewFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reuse helper from parent or duplicate? Creating simple duplicated handler for robust isolation
    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const f = Array.from(e.target.files);
            setNewFiles(f);
            setPreviews(f.map(file => URL.createObjectURL(file)));
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('name', newName);
        formData.append('description', newDesc);
        newFiles.forEach(f => formData.append('files', f));

        const res = await createStyle(formData);
        if (res.error) setErrorMsg(res.error);
        else onSuccess();
        setIsSubmitting(false);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111] border border-[#333] w-full max-w-md p-6 rounded-2xl relative shadow-2xl">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20} /></button>
                <h3 className="text-xl font-bold text-white uppercase mb-6">Add New Style</h3>
                {errorMsg && <div className="text-red-400 text-sm mb-4">{errorMsg}</div>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-[#050505] border border-[#333] p-3 rounded text-white" placeholder="Style Name" required />
                    <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} className="w-full bg-[#050505] border border-[#333] p-3 rounded text-white h-20" placeholder="Description" />
                    <input type="file" onChange={handleFile} className="text-white text-sm" accept="image/*" multiple required />
                    <button disabled={isSubmitting} className="w-full py-4 bg-[var(--primary)] text-black font-bold uppercase rounded mt-4">{isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : 'Create Style'}</button>
                </form>
            </motion.div>
        </div>
    )
}

function EditStyleModal({ style, onClose, onSuccess }: { style: PortfolioItem, onClose: () => void, onSuccess: () => void }) {
    const [name, setName] = useState(style.name);
    const [desc, setDesc] = useState(style.description || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Cropper State
    const [imageSrc, setImageSrc] = useState<string>(style.image_url);
    const [isDirty, setIsDirty] = useState(false); // If true, we need to upload the cropped result
    const [crop, setCrop] = useState({ x: 0, y: 0 }); // Pan offset percentage (-50 to 50)
    const [zoom, setZoom] = useState(1);
    const [newFile, setNewFile] = useState<File | null>(null);

    // Load new image for cropping
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageSrc(URL.createObjectURL(file));
            setNewFile(file);
            setIsDirty(true);
            setZoom(1);
            setCrop({ x: 0, y: 0 });
        }
    };

    // Output Function
    const getCroppedImg = async (): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.src = imageSrc;
            image.crossOrigin = "anonymous";
            image.onload = () => {
                const canvas = document.createElement('canvas');
                // Target: 4:3 Aspect, e.g. 800x600
                canvas.width = 800;
                canvas.height = 600;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // Logic:
                // We are rendering the image such that the "View Box" (the modal viewport) maps to the canvas.
                // The viewport is fixed at aspect 4:3.
                // The image inside is scaled by 'zoom' and translated by 'crop.x/y'.

                // Effective logic:
                // Draw image scaled and centered.

                // 1. Calculate Image Aspect
                const imgAspect = image.width / image.height;
                const targetAspect = 4 / 3; // 1.33

                let drawWidth, drawHeight;
                let offsetX = 0, offsetY = 0;

                // Fit behavior (Cover)
                if (imgAspect > targetAspect) {
                    // Image is wider than target -> Match height, crop width
                    drawHeight = canvas.height;
                    drawWidth = drawHeight * imgAspect;
                } else {
                    // Image is taller -> Match width, crop height
                    drawWidth = canvas.width;
                    drawHeight = drawWidth / imgAspect;
                }

                // Apply Zoom
                drawWidth *= zoom;
                drawHeight *= zoom;

                // Center
                offsetX = (canvas.width - drawWidth) / 2;
                offsetY = (canvas.height - drawHeight) / 2;

                // Apply Pan (crop.x is % shift)
                // If crop.x is 10, shift right by 10% of canvas width? 
                // Let's assume crop.x is pixels in the UI? 
                // Better: crop.x is percentage of the *image* dimension?
                // Let's interpret crop.x as percentage of canvas width shift.
                offsetX += (crop.x / 100) * canvas.width * zoom; // Amplify shift by zoom?
                offsetY += (crop.y / 100) * canvas.height * zoom;

                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

                canvas.toBlob(blob => {
                    if (blob) resolve(blob);
                    else reject(new Error('Canvas is empty'));
                }, 'image/jpeg', 0.9);
            };
            image.onerror = reject;
        });
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append('id', style.id);
        formData.append('name', name);
        formData.append('description', desc);

        // If newly uploaded or just re-cropped existing, we generate a file
        // Note: For existing URL (CORS), we might fail to crop if not proxy. 
        // Assuming Styles are same-origin or CORS enabled. They should be Supabase Storage public URLs.
        if (isDirty || newFile) {
            try {
                const blob = await getCroppedImg();
                const fileToUpload = new File([blob], "cropped.jpg", { type: "image/jpeg" });
                formData.append('file', fileToUpload);
            } catch (err) {
                console.warn("Crop failed, sending original if new file exists", err);
                if (newFile) formData.append('file', newFile);
            }
        }

        // Import locally to avoid circular dep issues in main component body if moved
        const { updateStyle } = await import('@/app/actions');
        const res = await updateStyle(formData);

        if (res.error) alert(res.error);
        else onSuccess();
        setIsSubmitting(false);
    }

    // Simple Pan Handler
    const handleDrag = (e: React.MouseEvent) => {
        if (e.buttons !== 1) return;
        setCrop(prev => ({
            x: prev.x + e.movementX * 0.5, // Sensitivity
            y: prev.y + e.movementY * 0.5
        }));
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#111] border border-[#333] w-full max-w-2xl p-6 rounded-2xl relative shadow-2xl flex flex-col md:flex-row gap-6 max-h-[90vh]">

                {/* Left: Image Cropper */}
                <div className="flex-1 flex flex-col gap-4">
                    <h4 className="text-white text-sm font-bold uppercase tracking-widest">Adjust Image (4:3)</h4>

                    {/* Viewport */}
                    <div
                        className="w-full aspect-[4/3] bg-black relative overflow-hidden rounded-lg border border-[var(--primary)] cursor-move touch-none"
                        onMouseMove={handleDrag}
                    >
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <img
                                src={imageSrc}
                                style={{
                                    transform: `translate(${crop.x}px, ${crop.y}px) scale(${zoom})`,
                                    transition: 'transform 0.05s linear' // Smooth drag
                                }}
                                className="max-w-none max-h-none min-w-full min-h-full object-cover opacity-90"
                                draggable={false}
                            />
                        </div>
                        {/* Grid Overlay */}
                        <div className="absolute inset-0 pointer-events-none opacity-30">
                            <div className="w-full h-1/3 border-b border-white"></div>
                            <div className="w-full h-2/3 border-b border-white text-white/50 text-xs p-1">Rule of Thirds</div>
                            <div className="absolute top-0 left-1/3 h-full border-r border-white"></div>
                            <div className="absolute top-0 right-1/3 h-full border-r border-white"></div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-500 uppercase">Zoom</span>
                        <input
                            type="range" min="1" max="3" step="0.1"
                            value={zoom} onChange={e => setZoom(parseFloat(e.target.value))}
                            className="flex-1 accent-[var(--primary)]"
                        />
                    </div>

                    <div className="relative border border-[#333] rounded p-2 text-center hover:bg-[#222] cursor-pointer transition-colors">
                        <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                        <span className="text-xs text-gray-400 uppercase font-bold">Upload New Image</span>
                    </div>
                </div>

                {/* Right: Meta */}
                <div className="w-full md:w-1/3 space-y-4 border-l border-[#222] pl-6 flex flex-col">
                    <div className="flex justify-between items-start">
                        <h3 className="text-xl font-bold text-white uppercase">Edit Style</h3>
                        <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
                    </div>

                    <div>
                        <label className="block text-xs font-mono text-gray-500 uppercase mb-1">Style Name</label>
                        <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#050505] border border-[#333] p-3 rounded text-white" />
                    </div>
                    <div>
                        <label className="block text-xs font-mono text-gray-500 uppercase mb-1">Description</label>
                        <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-[#050505] border border-[#333] p-3 rounded text-white h-32 resize-none" />
                    </div>

                    <div className="flex-1"></div>

                    <button
                        onClick={() => setIsDirty(true)} // Force dirty to re-crop existing image?
                        className="hidden" // Debug trigger
                    >Forced Crop</button>

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="w-full py-4 bg-[var(--primary)] text-black font-bold uppercase rounded hover:brightness-110 transition-all flex justify-center items-center gap-2"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : 'Save Changes'}
                    </button>
                    <p className="text-[10px] text-gray-600 text-center">Image will be cropped to visible area.</p>
                </div>

            </motion.div>
        </div>
    )
}
