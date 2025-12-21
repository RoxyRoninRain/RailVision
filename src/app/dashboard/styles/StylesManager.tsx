'use client';

import { useState, useEffect, useRef } from 'react';
import { PortfolioItem, createStyle, deleteStyle, seedDefaultStyles, updateStyleStatus, convertHeicToJpg } from '@/app/actions'; // Ensure these are exported from actions.ts
import { Plus, Trash2, Loader2, Image as ImageIcon, X, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function StylesManager({ initialStyles, serverError, logoUrl }: { initialStyles: PortfolioItem[], serverError?: string | null, logoUrl?: string | null }) {
    const [styles, setStyles] = useState<PortfolioItem[]>(initialStyles);
    const [isAdding, setIsAdding] = useState(false);
    const [editingStyle, setEditingStyle] = useState<PortfolioItem | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

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
    const [mainFile, setMainFile] = useState<File | null>(null);
    const [refFiles, setRefFiles] = useState<File[]>([]); // New Ref Files

    // UI Previews
    const [mainPreview, setMainPreview] = useState<string | null>(null);
    const [refPreviews, setRefPreviews] = useState<string[]>([]);

    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [priceMin, setPriceMin] = useState('');
    const [priceMax, setPriceMax] = useState('');

    const handleMainFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const f = e.target.files[0];
            setMainFile(f);
            setMainPreview(URL.createObjectURL(f));
        }
    };

    const handleRefFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            setRefFiles(files);
            setRefPreviews(files.map(f => URL.createObjectURL(f)));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mainFile) {
            setErrorMsg("Main Style Image is required.");
            return;
        }

        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('name', newName);
        formData.append('description', newDesc);
        if (priceMin) formData.append('price_min', priceMin);
        if (priceMax) formData.append('price_max', priceMax);

        // Critical Order: Main First, then Refs
        formData.append('files', mainFile);
        refFiles.forEach(f => formData.append('files', f));

        const res = await createStyle(formData);
        if (res.error) setErrorMsg(res.error);
        else onSuccess();
        setIsSubmitting(false);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111] border border-[#333] w-full max-w-md p-6 rounded-2xl relative shadow-2xl max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20} /></button>
                <h3 className="text-xl font-bold text-white uppercase mb-6">Add New Style</h3>
                {errorMsg && <div className="text-red-400 text-sm mb-4">{errorMsg}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-[#050505] border border-[#333] p-3 rounded text-white" placeholder="Style Name" required />
                    <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} className="w-full bg-[#050505] border border-[#333] p-3 rounded text-white h-20" placeholder="Description" />

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-xs text-gray-500 uppercase">Min Price ($/ft)</label>
                            <input type="number" value={priceMin} onChange={e => setPriceMin(e.target.value)} className="w-full bg-[#050505] border border-[#333] p-3 rounded text-white" placeholder="0.00" />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs text-gray-500 uppercase">Max Price ($/ft)</label>
                            <input type="number" value={priceMax} onChange={e => setPriceMax(e.target.value)} className="w-full bg-[#050505] border border-[#333] p-3 rounded text-white" placeholder="0.00" />
                        </div>
                    </div>

                    {/* Main Image */}
                    <div>
                        <label className="text-xs text-[var(--primary)] uppercase font-bold mb-2 block">1. Main Style Image (Visible)</label>
                        <div className="border border-dashed border-gray-700 p-4 rounded text-center cursor-pointer hover:bg-white/5 relative">
                            <input type="file" onChange={handleMainFile} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" required />
                            {mainPreview ? (
                                <img src={mainPreview} className="h-32 object-contain mx-auto" />
                            ) : (
                                <div className="text-gray-500 text-sm"><ImageIcon className="mx-auto mb-2" />Click to upload Main Image</div>
                            )}
                        </div>
                    </div>

                    {/* Reference Images */}
                    <div>
                        <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">2. AI Reference Images (Hidden)</label>
                        <div className="border border-dashed border-gray-700 p-4 rounded text-center cursor-pointer hover:bg-white/5 relative mb-2">
                            <input type="file" onChange={handleRefFiles} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" multiple />
                            <div className="text-gray-500 text-sm"><Plus className="mx-auto mb-2" />Add Reference Images</div>
                        </div>
                        {refPreviews.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto py-2">
                                {refPreviews.map((src, idx) => (
                                    <img key={idx} src={src} className="w-16 h-16 object-cover rounded border border-gray-800" />
                                ))}
                            </div>
                        )}
                    </div>

                    <button disabled={isSubmitting} className="w-full py-4 bg-[var(--primary)] text-black font-bold uppercase rounded mt-4">{isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : 'Create Style'}</button>
                </form>
            </motion.div>
        </div>
    )
}

// ... (imports remain same)

// ... (StylesManager component remains same until EditStyleModal)

function EditStyleModal({ style, onClose, onSuccess }: { style: PortfolioItem, onClose: () => void, onSuccess: () => void }) {
    const [name, setName] = useState(style.name);
    const [desc, setDesc] = useState(style.description || '');
    const [priceMin, setPriceMin] = useState(style.price_per_ft_min?.toString() || '');
    const [priceMax, setPriceMax] = useState(style.price_per_ft_max?.toString() || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Main Image Cropper State
    const [imageSrc, setImageSrc] = useState<string>(style.image_url);
    const [isDirty, setIsDirty] = useState(false);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [newFile, setNewFile] = useState<File | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Layout Constraints
    const [imgAspect, setImgAspect] = useState(1); // Width / Height

    // Reference Images State
    const [keptRefs, setKeptRefs] = useState<string[]>(style.reference_images || []);
    const [newRefFiles, setNewRefFiles] = useState<File[]>([]);
    const [newRefPreviews, setNewRefPreviews] = useState<string[]>([]);


    // Load new image for cropping
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageSrc(URL.createObjectURL(file));
            setNewFile(file);
            setIsDirty(true);
            setZoom(1);
            setCrop({ x: 0, y: 0 });
            // Aspect will be updated by onLoad
        }
    };

    const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        setImgAspect(naturalWidth / naturalHeight);
    };

    const handleNewRefs = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            setNewRefFiles(prev => [...prev, ...files]);
            setNewRefPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
        }
    }

    const removeKeptRef = (idx: number) => {
        setKeptRefs(prev => prev.filter((_, i) => i !== idx));
    }

    const removeNewRef = (idx: number) => {
        setNewRefFiles(prev => prev.filter((_, i) => i !== idx));
        setNewRefPreviews(prev => prev.filter((_, i) => i !== idx));
    }

    // Output Function
    const getCroppedImg = async (): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.src = imageSrc;
            image.crossOrigin = "anonymous";
            image.onload = () => {
                const canvas = document.createElement('canvas');
                // Target: Square 800x800
                canvas.width = 800;
                canvas.height = 800;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // 1. Calculate Image Aspect
                const imgAspect = image.width / image.height;
                const targetAspect = 1; // Square

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

                // Apply Pan (crop.x is % of CANVAS width delta)
                offsetX += crop.x * canvas.width;
                offsetY += crop.y * canvas.height;

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
        formData.append('price_min', priceMin);
        formData.append('price_max', priceMax);

        // Main Image Handling
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

        // References Handling
        newRefFiles.forEach(f => formData.append('reference_files', f));
        formData.append('kept_reference_urls', JSON.stringify(keptRefs));

        const { updateStyle } = await import('@/app/actions');
        const res = await updateStyle(formData);

        if (res.error) alert(res.error);
        else onSuccess();
        setIsSubmitting(false);
    }

    // Normalized Pan Handler with Constraints
    const handleDrag = (e: React.MouseEvent) => {
        if (e.buttons !== 1 || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        // Calculate delta as percentage of container
        const deltaX = e.movementX / rect.width;
        const deltaY = e.movementY / rect.height;

        setCrop(prev => {
            let nextX = prev.x + deltaX;
            let nextY = prev.y + deltaY;

            // Constraints Calculation
            // Target Aspect = 1 (Square).
            // Image Aspect = imgAspect.
            // If img is Wider (Aspect > 1):
            //   Base Width covers container (W_base = H_container * Aspect) -> W% = Aspect * 100%
            //   Base Height = 100%
            // If img is Taller (Aspect < 1):
            //   Base Width = 100%
            //   Base Height covers container (H_base = W_container / Aspect) -> H% = (1/Aspect) * 100%

            let baseW_ratio = imgAspect > 1 ? imgAspect : 1;
            let baseH_ratio = imgAspect > 1 ? 1 : (1 / imgAspect);

            const scaledW = baseW_ratio * zoom;
            const scaledH = baseH_ratio * zoom;

            // Max Deviation from center (0)
            // Range: [-(Scaled - 1)/2, +(Scaled - 1)/2]
            const maxX = (scaledW - 1) / 2;
            const maxY = (scaledH - 1) / 2;

            // Clamp
            if (nextX > maxX) nextX = maxX;
            if (nextX < -maxX) nextX = -maxX;
            if (nextY > maxY) nextY = maxY;
            if (nextY < -maxY) nextY = -maxY;

            return { x: nextX, y: nextY };
        });
        setIsDirty(true);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#111] border border-[#333] w-full max-w-4xl p-6 rounded-2xl relative shadow-2xl flex flex-col md:flex-row gap-6 max-h-[95vh] overflow-y-auto">

                {/* Left: Image Cropper (Main) */}
                <div className="flex-1 flex flex-col gap-4">
                    <h4 className="text-white text-sm font-bold uppercase tracking-widest">Adjust Main Image (Square)</h4>

                    {/* Viewport - ASPECT SQUARE */}
                    <div
                        ref={containerRef}
                        className="w-full aspect-square bg-black relative overflow-hidden rounded-lg border border-[var(--primary)] cursor-move touch-none"
                        onMouseMove={handleDrag}
                    >
                        {/* Wrapper handles Translate */}
                        <div
                            className="absolute inset-0 flex items-center justify-center pointer-events-none"
                            style={{
                                transform: `translate(${crop.x * 100}%, ${crop.y * 100}%)`,
                                transition: 'transform 0s linear'
                            }}
                        >
                            {/* Image handles Scale */}
                            <img
                                src={imageSrc}
                                onLoad={handleImgLoad}
                                style={{
                                    transform: `scale(${zoom})`,
                                    transition: 'transform 0.1s ease-out'
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
                            value={zoom} onChange={e => { setZoom(parseFloat(e.target.value)); setIsDirty(true); }}
                            className="flex-1 accent-[var(--primary)]"
                        />
                    </div>

                    <div className="relative border border-[#333] rounded p-2 text-center hover:bg-[#222] cursor-pointer transition-colors">
                        <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                        <span className="text-xs text-gray-400 uppercase font-bold">Upload Replacement Image</span>
                    </div>

                    {/* Reference Images Section */}
                    {/* ... (Kept as is) ... */}
                    <div className="mt-4 border-t border-[#333] pt-4">
                        <h4 className="text-white text-sm font-bold uppercase tracking-widest mb-2">AI Reference Images (Hidden)</h4>

                        {/* List Kept Refs */}
                        <div className="grid grid-cols-4 gap-2 mb-2">
                            {keptRefs.map((url, idx) => (
                                <div key={url} className="relative group aspect-square">
                                    <img src={url} className="w-full h-full object-cover rounded border border-gray-800" />
                                    <button onClick={() => removeKeptRef(idx)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"><X size={10} /></button>
                                </div>
                            ))}
                            {newRefPreviews.map((url, idx) => (
                                <div key={url} className="relative group aspect-square">
                                    <img src={url} className="w-full h-full object-cover rounded border border-green-800 opacity-80" />
                                    <button onClick={() => removeNewRef(idx)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"><X size={10} /></button>
                                </div>
                            ))}

                            <div className="relative border border-dashed border-gray-800 rounded aspect-square flex items-center justify-center hover:bg-white/5 cursor-pointer">
                                <input type="file" onChange={handleNewRefs} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" multiple />
                                <Plus size={20} className="text-gray-500" />
                            </div>
                        </div>
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

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-mono text-gray-500 uppercase mb-1">Min Price ($/ft)</label>
                            <input type="number" value={priceMin} onChange={e => setPriceMin(e.target.value)} className="w-full bg-[#050505] border border-[#333] p-3 rounded text-white" placeholder="0.00" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-mono text-gray-500 uppercase mb-1">Max Price ($/ft)</label>
                            <input type="number" value={priceMax} onChange={e => setPriceMax(e.target.value)} className="w-full bg-[#050505] border border-[#333] p-3 rounded text-white" placeholder="0.00" />
                        </div>
                    </div>

                    <div className="flex-1"></div>

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="w-full py-4 bg-[var(--primary)] text-black font-bold uppercase rounded hover:brightness-110 transition-all flex justify-center items-center gap-2"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : 'Save Changes'}
                    </button>
                    <p className="text-[10px] text-gray-600 text-center">Image will be cropped to visible area (Square).</p>
                </div>

            </motion.div>
        </div>
    )
}
