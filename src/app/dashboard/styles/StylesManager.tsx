'use client';

import { useState } from 'react';
import { PortfolioItem, createStyle, deleteStyle } from '@/app/actions'; // Ensure these are exported from actions.ts
import { Plus, Trash2, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function StylesManager({ initialStyles }: { initialStyles: PortfolioItem[] }) {
    const [styles, setStyles] = useState<PortfolioItem[]>(initialStyles);
    const [isAdding, setIsAdding] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newFile, setNewFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Image Compression Helper
    const compressImage = async (file: File): Promise<File> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Max dimensions (e.g. 1500px)
                const MAX_SIZE = 1500;
                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
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
                }, 'image/jpeg', 0.85); // 85% quality
            };
            img.onerror = (err) => reject(err);
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setErrorMsg(null); // Clear previous errors
        if (e.target.files && e.target.files[0]) {
            let file = e.target.files[0];

            // HEIC Detection & Conversion
            try {
                if (file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic' || file.type === 'image/heif') {
                    console.log('HEIC detected, converting to JPEG...');
                    const heic2any = (await import('heic2any')).default;
                    const convertedBlob = await heic2any({
                        blob: file,
                        toType: 'image/jpeg',
                        quality: 0.9
                    });

                    // heic2any can return Blob or Blob[]
                    const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

                    file = new File([blob], file.name.replace(/\.(heic|HEIC|heif|HEIF)$/, '.jpg'), {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    console.log('HEIC conversion successful.');
                }
            } catch (err) {
                console.error('HEIC conversion failed:', err);
                setErrorMsg('HEIC conversion failed. Please use a JPG or PNG.');
                return;
            }

            // Validate basic type (Post-conversion check)
            if (!file.type.startsWith('image/')) {
                setErrorMsg('Please upload an image file (JPG, PNG).');
                return;
            }

            // Client-side Resize/Compression if > 1MB or large IDK
            try {
                if (file.size > 1 * 1024 * 1024) { // If > 1MB, try to compress
                    console.log(`Compressing image: ${file.size / 1024 / 1024}MB`);
                    const compressed = await compressImage(file);
                    console.log(`Compressed to: ${compressed.size / 1024 / 1024}MB`);
                    // If compression actually made it bigger (rare but possible with low qual orig), keep orig
                    if (compressed.size < file.size) {
                        file = compressed;
                    }
                }
            } catch (err) {
                console.error('Compression failed, using original', err);
            }

            setNewFile(file);
            setPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);
        if (!newFile || !newName) {
            setErrorMsg('Please provide a name and an image.');
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
                setErrorMsg(res.error);
                setIsSubmitting(false);
            } else {
                setSuccessMsg('Style created successfully! updating...');
                // Slight delay so user sees success message
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
        } catch (err: any) {
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

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-white">Your Portfolio</h2>
                    <p className="text-gray-500 font-mono text-sm mt-1">Manage custom styles for your clients.</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 bg-[var(--primary)] text-black px-4 py-2 rounded font-bold uppercase tracking-wider hover:brightness-110 transition-colors"
                >
                    <Plus size={18} /> Add New Style
                </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                            className="group relative aspect-[4/3] bg-[#111] rounded-xl overflow-hidden border border-[#222] hover:border-[var(--primary)] transition-colors"
                        >
                            <img src={style.image_url} alt={style.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-6 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                <h4 className="text-xl font-bold text-white uppercase">{style.name}</h4>
                                <p className="text-gray-400 text-xs mb-4 line-clamp-2">{style.description}</p>
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
                                    disabled={isSubmitting}
                                    className="w-full py-4 bg-[var(--primary)] text-black font-bold uppercase tracking-widest rounded hover:brightness-110 transition-all mt-4 flex justify-center items-center gap-2"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : 'Create Style'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
