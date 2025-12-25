'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { listBucketFiles } from '@/app/admin/actions';
import { ArrowLeft, File as FileIcon, Download, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface StorageFile {
    name: string;
    id: string; // valid for buckets, sometimes null
    updated_at: string;
    created_at: string;
    last_accessed_at: string;
    metadata: Record<string, any>;
    publicUrl?: string;
}

export default function TenantAssetsPage() {
    const params = useParams();
    const id = params?.id as string;

    const [files, setFiles] = useState<{
        logos: StorageFile[];
        quotes: StorageFile[];
        assets: StorageFile[];
    }>({ logos: [], quotes: [], assets: [] });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchFiles = async () => {
        setLoading(true);
        setError(null);
        try {
            // Parallel Fetch
            const [logosRes, quotesRes, assetsRes] = await Promise.all([
                listBucketFiles('logos', id),
                listBucketFiles('quote-uploads', id),
                listBucketFiles('tenant-assets', id)
            ]);

            const newFiles = {
                logos: logosRes.data || [],
                quotes: quotesRes.data || [],
                assets: assetsRes.data || []
            };

            setFiles(newFiles);

            if (logosRes.error || quotesRes.error || assetsRes.error) {
                console.warn("Some buckets failed:", { logosRes, quotesRes, assetsRes });
                // We don't block the UI, just show what we got
            }

        } catch (err: any) {
            console.error("Failed to fetch assets:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) fetchFiles();
    }, [id]);

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans">
            <header className="border-b border-white/10 bg-[#0a0a0a]">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href={`/admin/tenants/${id}`} className="text-gray-400 hover:text-white flex items-center gap-2 text-sm font-mono transition-colors">
                        <ArrowLeft size={16} /> BACK TO TENANT
                    </Link>
                    <div className="font-mono text-xs text-gray-600">ASSET VIEWER: {id}</div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold uppercase tracking-tight">Tenant Assets</h1>
                    <button
                        onClick={fetchFiles}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 rounded text-xs font-bold uppercase tracking-wider transition-colors"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
                    </button>
                </div>

                {error && (
                    <div className="bg-red-900/20 border border-red-900/50 p-4 rounded text-red-200 text-sm flex items-center gap-2">
                        <AlertTriangle size={16} /> {error}
                    </div>
                )}

                {/* LOGOS */}
                <Section title="Logos" bucket="logos" files={files.logos} loading={loading} />

                {/* ASSETS */}
                <Section title="Onboarding Assets" bucket="tenant-assets" files={files.assets} loading={loading} />

                {/* QUOTES */}
                <Section title="Quote Uploads" bucket="quote-uploads" files={files.quotes} loading={loading} />

            </main>
        </div>
    );
}

function Section({ title, bucket, files, loading }: { title: string, bucket: string, files: StorageFile[], loading: boolean }) {
    if (loading) return (
        <div className="border border-white/10 rounded-lg p-6 bg-[#111]">
            <h3 className="text-sm font-mono text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                {title} <span className="text-[10px] bg-zinc-800 px-1 py-0.5 rounded text-zinc-500">{bucket}</span>
            </h3>
            <div className="h-20 flex items-center justify-center text-gray-600 text-xs animate-pulse">Scanning bucket...</div>
        </div>
    );

    return (
        <div className="border border-white/10 rounded-lg p-6 bg-[#111]">
            <h3 className="text-sm font-mono text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                {title} <span className="text-[10px] bg-zinc-800 px-1 py-0.5 rounded text-zinc-500">{bucket}</span>
            </h3>

            {files.length === 0 ? (
                <div className="text-gray-600 italic text-sm py-4">
                    Bucket is empty or folder not found.
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {files.map((file) => {
                        const isImage = file.metadata?.mimetype?.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);

                        return (
                            <div key={file.id || file.name} className="group relative bg-[#0a0a0a] border border-white/5 rounded-lg overflow-hidden transition-all hover:border-white/20">
                                <div className="aspect-square flex items-center justify-center bg-[#151515] overflow-hidden relative">
                                    {isImage && file.publicUrl ? (
                                        <img src={file.publicUrl} alt={file.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                    ) : (
                                        <FileIcon className="text-gray-700" size={32} />
                                    )}

                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
                                        <a href={file.publicUrl} target="_blank" rel="noopener" className="p-2 bg-white/10 rounded-full hover:bg-white/30 text-white transition-colors">
                                            <ExternalLink size={16} />
                                        </a>
                                        <a href={file.publicUrl} download className="p-2 bg-white/10 rounded-full hover:bg-white/30 text-white transition-colors">
                                            <Download size={16} />
                                        </a>
                                    </div>
                                </div>
                                <div className="p-3">
                                    <div className="text-xs font-mono text-gray-300 truncate" title={file.name}>{file.name}</div>
                                    <div className="text-[10px] text-gray-600 mt-1">
                                        {(file.metadata?.size / 1024).toFixed(1)} KB
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
