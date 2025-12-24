'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Upload, Folder, FileImage, Trash2, Plus, Loader2, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AssetFile {
    name: string;
    id: string; // usually name
    url?: string;
    // metadata
}

interface AssetFolder {
    name: string;
    files: AssetFile[];
}

export default function OnboardingUploadsPage() {
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [folders, setFolders] = useState<AssetFolder[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Upload State
    const [selectedFolder, setSelectedFolder] = useState<string>('General');
    const [newFolderName, setNewFolderName] = useState('');
    const [dragActive, setDragActive] = useState(false);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const fetchAssets = useCallback(async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // List all files in the bucket for this user
            // We list the root folder for the user: user.id/
            const { data, error } = await supabase.storage
                .from('tenant-assets')
                .list(`${user.id}`, {
                    limit: 100,
                    sortBy: { column: 'name', order: 'asc' },
                });

            if (error) throw error;

            // The list command returns files and folders at the root.
            // If we want nested folders, we usually need recursive listing or just support 1-level depth.
            // Let's support 1-level depth: UserID -> Folder -> Files.

            // 1. Identify folders (objects with id=null usually, or metadata)
            // Supabase storage list returns folders as PLACEHOLDERS if we are not using recursive?
            // Actually, list(path) returns children of that path.

            // If we iterate through the results items that are folders...
            // But 'list' isn't recursive by default.
            // Strategy: We list the User Root. We see folders. We then list each folder?
            // That's too many requests. 
            // Better: We just treat "Folder" as a prefix we know about?
            // No, we should discovery them.

            // Let's assume 'data' contains folders.
            const detectedFolders: AssetFolder[] = [];
            const rootFiles: AssetFile[] = [];

            // Parallel fetch for contents of each detected folder
            const folderPromises = data.map(async (item) => {
                // Determine if it is a folder? (no size, or metadata.mimetype?)
                // Supabase doesn't strictly differentiate except by id sometimes being null
                // or if we list with correct options.

                // Alternative: We just use a flat structure for now or try to detect.
                // If it doesn't have an ID, it's often a folder.
                if (!item.id) {
                    // It's a folder
                    const folderName = item.name;
                    const { data: folderFiles } = await supabase.storage
                        .from('tenant-assets')
                        .list(`${user.id}/${folderName}`);

                    if (folderFiles) {
                        detectedFolders.push({
                            name: folderName,
                            files: folderFiles.map(f => ({ ...f, name: f.name, id: f.id || f.name }))
                        });
                    }
                } else {
                    // It's a file in the root 'General' (conceptually)
                    rootFiles.push({ ...item, name: item.name, id: item.id });
                }
            });

            await Promise.all(folderPromises);

            // Add root files to 'General' if any
            if (rootFiles.length > 0) {
                // Check if 'General' already exists in detectedFolders
                const existingGen = detectedFolders.find(f => f.name === 'General');
                if (existingGen) {
                    existingGen.files.push(...rootFiles);
                } else {
                    detectedFolders.unshift({ name: 'General', files: rootFiles });
                }
            } else if (detectedFolders.length === 0) {
                // Empty state, provide General
                detectedFolders.push({ name: 'General', files: [] });
            }

            setFolders(detectedFolders.sort((a, b) => a.name.localeCompare(b.name)));
            if (!selectedFolder && detectedFolders.length > 0) setSelectedFolder(detectedFolders[0].name);

        } catch (err) {
            console.error('Error fetching assets:', err);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchAssets();
    }, [fetchAssets, refreshTrigger]);


    const handleUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const folder = newFolderName || selectedFolder || 'General';

            // Upload sequentially or parallel
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const path = `${user.id}/${folder}/${file.name}`; // Overwrite if same name?

                await supabase.storage
                    .from('tenant-assets')
                    .upload(path, file, { upsert: true });
            }

            setNewFolderName(''); // Reset new folder input
            setSelectedFolder(folder); // Switch to that folder
            setRefreshTrigger(prev => prev + 1);

        } catch (err: any) {
            console.error('Upload failed:', err);
            alert('Upload failed: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (folderName: string, fileName: string) => {
        if (!confirm('Are you sure you want to delete this file?')) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase.storage
                .from('tenant-assets')
                .remove([`${user.id}/${folderName}/${fileName}`]);

            setRefreshTrigger(prev => prev + 1);
        } catch (err) {
            console.error('Delete failed', err);
        }
    };

    // UI Helpers
    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleUpload(e.dataTransfer.files);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto text-white min-h-screen">
            <header className="mb-12">
                <h1 className="text-4xl font-mono font-bold uppercase tracking-tight mb-2 text-white">
                    Project Assets
                </h1>
                <p className="text-gray-500 max-w-2xl">
                    Upload images, style references, and other assets. Organize them into folders for easy access during the design process.
                </p>
            </header>

            {/* Upload Area */}
            <div
                className={`
                    border-2 border-dashed rounded-xl p-8 mb-12 transition-all cursor-pointer relative overflow-hidden
                    ${dragActive ? 'border-primary bg-primary/10' : 'border-gray-800 bg-zinc-900/50 hover:border-gray-700'}
                `}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    multiple
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    onChange={(e) => handleUpload(e.target.files)}
                />

                <div className="flex flex-col items-center justify-center text-center">
                    {uploading ? (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <Loader2 className="animate-spin text-primary" size={48} />
                            <p className="text-lg font-bold">Uploading Assets...</p>
                        </div>
                    ) : (
                        <>
                            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4 text-gray-400">
                                <Upload size={32} />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Drag & Drop Files Here</h3>
                            <p className="text-gray-500 mb-6 text-sm">or click to browse from your computer</p>

                            <div className="flex items-center gap-4 bg-black/50 p-2 rounded-lg border border-gray-800 z-20 relative" onClick={(e) => e.stopPropagation()}>
                                <Folder size={16} className="text-primary" />
                                <span className="text-sm text-gray-400">Upload to:</span>
                                <select
                                    value={selectedFolder}
                                    onChange={(e) => {
                                        if (e.target.value === 'NEW') return; // Handled by UI switch?
                                        setSelectedFolder(e.target.value)
                                        setNewFolderName('');
                                    }}
                                    className="bg-transparent text-white text-sm outline-none font-bold"
                                >
                                    {folders.map(f => (
                                        <option key={f.name} value={f.name} className="text-black">{f.name}</option>
                                    ))}
                                    <option value="NEW" className="text-primary font-bold">+ New Folder</option>
                                </select>
                                <input
                                    type="text"
                                    placeholder="New Folder Name"
                                    value={newFolderName}
                                    onChange={(e) => {
                                        setNewFolderName(e.target.value);
                                        setSelectedFolder(''); // Clear select
                                    }}
                                    className="bg-transparent border-b border-gray-600 focus:border-primary outline-none text-sm px-2 w-32"
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Folders & Files */}
            <div className="space-y-8">
                {loading ? (
                    <div className="flex items-center gap-2 text-gray-500">
                        <Loader2 className="animate-spin" size={16} /> Loading assets...
                    </div>
                ) : (
                    folders.map((folder) => (
                        <div key={folder.name} className="bg-[#111] border border-gray-800 rounded-xl overflow-hidden">
                            <div className="bg-zinc-900/50 p-4 border-b border-gray-800 flex items-center gap-3">
                                <FolderOpen className="text-primary" size={20} />
                                <h3 className="font-bold text-lg">{folder.name}</h3>
                                <span className="text-xs text-gray-500 bg-black px-2 py-1 rounded-full">
                                    {folder.files.length} items
                                </span>
                            </div>

                            <div className="p-4">
                                {folder.files.length === 0 ? (
                                    <div className="text-center py-8 text-gray-600 text-sm">
                                        No files in this folder.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        {folder.files.map((file) => (
                                            <div key={file.id} className="group relative aspect-square bg-black rounded-lg border border-gray-800 overflow-hidden">
                                                {/* Preview (if image) */}
                                                {(file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ? (
                                                    // We need a signed URL or public URL. 
                                                    // Assuming bucket is private? The migration said public=false.
                                                    // But we can get a public URL if we change bucket to public, or getSignedUrl.
                                                    // Let's use getPublicUrl assuming we switch it to public or specific access.
                                                    // Actually, migration said public=false. So we need signed URL.
                                                    // Or better: make bucket public for authenticated reads?
                                                    // For now, let's use a quick component to fetch the signed URL.
                                                    <SecureImage bucket="tenant-assets" path={`${folder.name}/${file.name}`} />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-700">
                                                        <FileImage size={32} />
                                                    </div>
                                                )}

                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                                    <p className="text-xs text-white truncate mb-2">{file.name}</p>
                                                    <button
                                                        onClick={() => handleDelete(folder.name, file.name)}
                                                        className="mt-auto bg-red-900/80 p-2 rounded text-red-200 hover:bg-red-900 transition-colors w-full flex items-center justify-center"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// Helper component to display private bucket images
function SecureImage({ bucket, path }: { bucket: string, path: string }) {
    const [src, setSrc] = useState<string | null>(null);
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        const fetchUrl = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            // Path passed is Folder/File. Full path is UserID/Folder/File
            const fullPath = `${user.id}/${path}`;

            const { data } = await supabase.storage
                .from(bucket)
                .createSignedUrl(fullPath, 3600); // 1 hour

            if (data) setSrc(data.signedUrl);
        };
        fetchUrl();
    }, [bucket, path, supabase]);

    if (!src) return <div className="w-full h-full flex items-center justify-center bg-zinc-900 animate-pulse" />;

    return (
        <img src={src} alt={path} className="w-full h-full object-cover" />
    );
}
