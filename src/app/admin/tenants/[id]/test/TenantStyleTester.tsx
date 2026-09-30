'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Shield,
    Sparkles,
    Loader2,
    Upload,
    Check,
    AlertCircle,
    Download,
    ExternalLink,
    RefreshCw,
    Sliders,
    Layers,
    Info,
    ImageIcon,
    Palette,
    Plus,
    Trash2,
    X,
    BookmarkPlus
} from 'lucide-react';
import Link from 'next/link';
import { testTenantStyle } from '@/app/admin/actions';
import { compressImage } from '@/utils/imageUtils';

interface TenantStyleTesterProps {
    tenantId: string;
    profile: any;
    initialStyles: any[];
    allTenants: any[];
}

export interface PresetScene {
    id: string;
    name: string;
    category: string;
    url: string;
    isDefault?: boolean;
}

const DEFAULT_PRESET_SCENES: PresetScene[] = [
    {
        id: 'interior-hardwood-stairs',
        name: 'Interior Stairs (3/4 Angle)',
        category: 'Interior',
        url: '/presets/interior-hardwood-stairs.jpg',
        isDefault: true,
    },
    {
        id: 'front-porch-steps',
        name: 'Front Porch Steps (Side Angle)',
        category: 'Exterior',
        url: '/presets/front-porch-steps.jpg',
        isDefault: true,
    },
    {
        id: 'exterior-deck-steps',
        name: 'Deck Stairs & Rim (Side View)',
        category: 'Exterior',
        url: '/presets/exterior-deck-steps.jpg',
        isDefault: true,
    },
    {
        id: 'modern-floating-stairs',
        name: 'Modern Open Treads (3/4 Angle)',
        category: 'Interior',
        url: '/presets/modern-floating-stairs.jpg',
        isDefault: true,
    },
];

export default function TenantStyleTester({
    tenantId,
    profile,
    initialStyles,
    allTenants,
}: TenantStyleTesterProps) {
    const router = useRouter();

    // Scene Image state
    const [sceneFile, setSceneFile] = useState<File | null>(null);
    const [scenePreview, setScenePreview] = useState<string | null>(DEFAULT_PRESET_SCENES[0].url);
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(DEFAULT_PRESET_SCENES[0].id);
    const [loadingScene, setLoadingScene] = useState(false);
    const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);

    // Custom Presets Management State
    const [customPresets, setCustomPresets] = useState<PresetScene[]>([]);
    const [isAddingPreset, setIsAddingPreset] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const [newPresetCategory, setNewPresetCategory] = useState<'Interior' | 'Exterior'>('Interior');
    const [newPresetDataUrl, setNewPresetDataUrl] = useState<string | null>(null);
    const [newPresetFile, setNewPresetFile] = useState<File | null>(null);
    const [isSavingPreset, setIsSavingPreset] = useState(false);

    // Load custom presets from localStorage on client mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('ag_admin_preset_scenes');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setCustomPresets(parsed);
                }
            }
        } catch (err) {
            console.warn('Failed to load custom presets from localStorage', err);
        }
    }, []);

    // Combined presets list (custom presets first, then defaults)
    const allPresets = [...customPresets, ...DEFAULT_PRESET_SCENES];

    // Style selection state
    const [selectedStyleId, setSelectedStyleId] = useState<string>(
        initialStyles.length > 0 ? initialStyles[0].id : 'custom'
    );
    const [customStyleFile, setCustomStyleFile] = useState<File | null>(null);
    const [customStylePreview, setCustomStylePreview] = useState<string | null>(null);

    // Troubleshooting / Technical Specs overrides
    const [bottomRailOverride, setBottomRailOverride] = useState<'default' | 'with_rail' | 'without_rail'>('default');
    const [reducerOverride, setReducerOverride] = useState<'default' | 'without_reducers' | 'with_reducers'>('default');
    const [customPromptNote, setCustomPromptNote] = useState<string>('');
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Execution & Result state
    const [isGenerating, setIsGenerating] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [diagnostics, setDiagnostics] = useState<{
        durationMs?: number;
        usage?: any;
        styleUsed?: any;
    } | null>(null);
    const [viewMode, setViewMode] = useState<'side-by-side' | 'result-only' | 'scene-only'>('side-by-side');

    // Handler for selecting preset scene
    const handleSelectPreset = async (preset: PresetScene) => {
        setSelectedPresetId(preset.id);
        setSceneFile(null); // Clear custom one-off file
        setUploadedDataUrl(null);
        setScenePreview(preset.url);
    };

    // Save a custom preset to state and localStorage
    const saveCustomPreset = (name: string, category: string, dataUrl: string) => {
        const newPreset: PresetScene = {
            id: `custom-preset-${Date.now()}`,
            name: name.trim() || 'Custom Stair Scene',
            category: category || 'Exterior',
            url: dataUrl,
            isDefault: false,
        };
        const updated = [newPreset, ...customPresets];
        setCustomPresets(updated);
        try {
            localStorage.setItem('ag_admin_preset_scenes', JSON.stringify(updated));
        } catch (storageErr) {
            console.warn('LocalStorage quota limit reached, preset kept in-memory', storageErr);
        }
        handleSelectPreset(newPreset);
    };

    // Delete a custom preset
    const handleDeleteCustomPreset = (presetId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updated = customPresets.filter(p => p.id !== presetId);
        setCustomPresets(updated);
        try {
            localStorage.setItem('ag_admin_preset_scenes', JSON.stringify(updated));
        } catch (storageErr) {
            console.warn('Failed to update localStorage', storageErr);
        }
        if (selectedPresetId === presetId) {
            handleSelectPreset(DEFAULT_PRESET_SCENES[0]);
        }
    };

    // File change handler for "+ Add Preset" form
    const handleNewPresetFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        try {
            const rawFile = e.target.files[0];
            const compressed = await compressImage(rawFile);
            setNewPresetFile(compressed);

            const reader = new FileReader();
            reader.onloadend = () => {
                setNewPresetDataUrl(reader.result as string);
            };
            reader.readAsDataURL(compressed);

            if (!newPresetName) {
                const cleanName = rawFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
                setNewPresetName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
            }
        } catch (err: any) {
            setError(`Failed to process preset image: ${err.message}`);
        }
    };

    // Submit new preset from form
    const handleSubmitNewPreset = () => {
        if (!newPresetDataUrl || !newPresetName.trim()) {
            setError('Please choose an image and enter a name for the preset.');
            return;
        }
        setIsSavingPreset(true);
        try {
            saveCustomPreset(newPresetName, newPresetCategory, newPresetDataUrl);
            setIsAddingPreset(false);
            setNewPresetName('');
            setNewPresetFile(null);
            setNewPresetDataUrl(null);
        } finally {
            setIsSavingPreset(false);
        }
    };

    // Handler for uploading custom scene image
    const handleCustomSceneUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        setLoadingScene(true);
        setError(null);
        try {
            const rawFile = e.target.files[0];
            const compressed = await compressImage(rawFile);
            setSceneFile(compressed);
            setSelectedPresetId(null);

            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                setUploadedDataUrl(dataUrl);
                setScenePreview(dataUrl);
            };
            reader.readAsDataURL(compressed);
        } catch (err: any) {
            console.error('Failed to process image:', err);
            setError(`Image processing error: ${err.message}`);
        } finally {
            setLoadingScene(false);
        }
    };

    // Handler for custom style reference upload
    const handleCustomStyleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        try {
            const rawFile = e.target.files[0];
            const compressed = await compressImage(rawFile);
            setCustomStyleFile(compressed);
            setCustomStylePreview(URL.createObjectURL(compressed));
            setSelectedStyleId('custom');
        } catch (err: any) {
            console.error('Failed to process style image:', err);
            setError(`Style image processing error: ${err.message}`);
        }
    };

    // Execute test generation
    const handleRunTest = async () => {
        setError(null);
        setIsGenerating(true);

        try {
            // Prepare scene file
            let targetFileToUpload: File | null = sceneFile;

            // If a preset was selected and no file uploaded, fetch preset as File
            if (!targetFileToUpload && scenePreview) {
                const response = await fetch(scenePreview);
                const blob = await response.blob();
                targetFileToUpload = new File([blob], 'preset-scene.jpg', { type: 'image/jpeg' });
            }

            if (!targetFileToUpload) {
                setError('Please select or upload a scene image.');
                setIsGenerating(false);
                return;
            }

            const formData = new FormData();
            formData.append('image', targetFileToUpload);
            formData.append('organization_id', tenantId);
            formData.append('tenant_id', tenantId);
            formData.append('is_admin_test', 'true');

            // Style configuration
            if (selectedStyleId === 'custom') {
                if (!customStyleFile) {
                    setError('Please upload a custom style reference image, or choose an existing style.');
                    setIsGenerating(false);
                    return;
                }
                formData.append('style', 'Custom Onboarding Style');
                formData.append('style_image', customStyleFile);
            } else {
                const currentStyle = initialStyles.find(s => s.id === selectedStyleId);
                if (!currentStyle) {
                    setError('Selected style not found.');
                    setIsGenerating(false);
                    return;
                }
                formData.append('styleId', currentStyle.id);
                formData.append('style', currentStyle.name);
                if (currentStyle.image_url) {
                    formData.append('style_url', currentStyle.image_url);
                }
                if (currentStyle.description) {
                    formData.append('style_description', currentStyle.description);
                }
            }

            // Specs overrides
            if (bottomRailOverride === 'with_rail') {
                formData.append('has_bottom_rail', 'true');
            } else if (bottomRailOverride === 'without_rail') {
                formData.append('has_bottom_rail', 'false');
            }

            if (reducerOverride === 'with_reducers') {
                formData.append('has_reducers', 'true');
            } else if (reducerOverride === 'without_reducers') {
                formData.append('has_reducers', 'false');
            }

            if (customPromptNote.trim()) {
                formData.append('prompt', customPromptNote.trim());
            }

            const res = await testTenantStyle(formData);

            if (res.success && res.image) {
                setResultImage(res.image);
                setDiagnostics({
                    durationMs: res.durationMs,
                    usage: res.usage,
                    styleUsed: selectedStyleId === 'custom' ? { name: 'Custom Reference Image' } : initialStyles.find(s => s.id === selectedStyleId)
                });
            } else {
                setError(res.error || 'Generation failed. Please verify the image inputs.');
            }
        } catch (err: any) {
            console.error('Test generation error:', err);
            setError(err.message || 'An unexpected error occurred during generation.');
        } finally {
            setIsGenerating(false);
        }
    };

    const selectedStyleObj = initialStyles.find(s => s.id === selectedStyleId);

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-16 font-sans">
            {/* TOP NAVIGATION & SWITCHER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
                <div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <Link href="/admin/tenants" className="hover:text-white transition-colors">Tenants</Link>
                        <span>/</span>
                        <Link href={`/admin/tenants/${tenantId}`} className="hover:text-white transition-colors">
                            {profile?.shop_name || 'Tenant Details'}
                        </Link>
                        <span>/</span>
                        <span className="text-emerald-400 font-mono">Style Testing Studio</span>
                    </div>
                    <h1 className="text-3xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                        <Sparkles className="text-emerald-400" size={28} />
                        Tenant Style Tester
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Testing styles for <strong className="text-white">{profile?.shop_name || 'Unnamed Shop'}</strong> ({profile?.email})
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Quick Tenant Switcher */}
                    <div className="flex items-center gap-2 bg-[#111] border border-white/10 rounded px-3 py-1.5 text-xs">
                        <span className="text-gray-500 font-mono uppercase">Tenant:</span>
                        <select
                            value={tenantId}
                            onChange={(e) => router.push(`/admin/tenants/${e.target.value}/test`)}
                            className="bg-transparent text-white font-mono outline-none cursor-pointer max-w-[180px] truncate"
                        >
                            {allTenants.map((t: any) => (
                                <option key={t.organization_id} value={t.organization_id} className="bg-black text-white">
                                    {t.shop_name || t.email || t.organization_id.substring(0, 8)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <Link
                        href={`/admin/tenants/${tenantId}/styles`}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white px-3 py-2 rounded text-xs font-mono font-bold uppercase transition-colors flex items-center gap-1.5"
                    >
                        <Palette size={14} /> Manage Styles
                    </Link>

                    <Link
                        href={`/demo?org=${tenantId}&admin_test=true`}
                        target="_blank"
                        className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 px-3 py-2 rounded text-xs font-mono font-bold uppercase transition-colors flex items-center gap-1.5"
                    >
                        <ExternalLink size={14} /> Open Live Widget
                    </Link>
                </div>
            </div>

            {/* ZERO-CHARGE ASSURANCE BANNER */}
            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                        <Shield size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white text-base">Zero-Charge Admin Testing Mode Active</h3>
                            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold">
                                $0.00 Cost
                            </span>
                        </div>
                        <p className="text-gray-400 text-xs mt-1 max-w-3xl leading-relaxed">
                            Generations executed in this sandbox do <strong>not</strong> consume tenant allowances, will <strong>not</strong> report metered charges to Stripe, and will <strong>not</strong> increment the tenant's usage balance. Rate limits and subscription requirements are bypassed for testing and troubleshooting.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end md:self-auto text-xs font-mono">
                    <div className="bg-black/40 border border-white/10 px-3 py-1.5 rounded">
                        <span className="text-gray-500 mr-2">Subscription:</span>
                        <span className={profile?.subscription_status === 'active' ? 'text-green-400' : 'text-yellow-400'}>
                            {profile?.subscription_status || 'Inactive (Bypassed)'}
                        </span>
                    </div>
                    <div className="bg-black/40 border border-white/10 px-3 py-1.5 rounded">
                        <span className="text-gray-500 mr-2">Styles:</span>
                        <span className="text-white font-bold">{initialStyles.length} Available</span>
                    </div>
                </div>
            </div>

            {/* MAIN WORKFLOW GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* LEFT COLUMN: CONTROLS & SETUP (5 cols) */}
                <div className="lg:col-span-5 space-y-6">

                    {/* STEP 1: SCENE SELECTION */}
                    <div className="bg-[#111] border border-white/10 rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                            <div className="flex items-center gap-2 font-bold text-white text-sm uppercase tracking-wide font-mono">
                                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">1</span>
                                Choose Scene / Stairs Photo
                            </div>
                            {scenePreview && (
                                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/20">
                                    Scene Loaded
                                </span>
                            )}
                        </div>

                        {/* Preset Scenes Header & Add Button */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-mono uppercase text-gray-400 block">
                                    Preset Scenes ({allPresets.length}):
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setIsAddingPreset(!isAddingPreset)}
                                    className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/30 px-2 py-0.5 rounded transition-colors"
                                >
                                    {isAddingPreset ? <X size={12} /> : <Plus size={12} />}
                                    {isAddingPreset ? 'Cancel' : 'Add Custom Preset'}
                                </button>
                            </div>

                            {/* Expandable Add Custom Preset Panel */}
                            {isAddingPreset && (
                                <div className="bg-black/60 border border-emerald-500/40 rounded-lg p-3 mb-3 space-y-3">
                                    <div className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                                        <Plus size={13} /> Upload & Save Reusable Preset Scene
                                    </div>
                                    <div className="space-y-2">
                                        <label className="flex items-center justify-center p-3 border border-dashed border-white/20 hover:border-emerald-500/50 rounded cursor-pointer bg-black/40 text-center">
                                            <input
                                                type="file"
                                                accept="image/*,.heic"
                                                onChange={handleNewPresetFileChange}
                                                className="hidden"
                                            />
                                            {newPresetDataUrl ? (
                                                <div className="flex items-center gap-3">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={newPresetDataUrl} alt="Preview" className="w-12 h-12 object-cover rounded border border-white/20" />
                                                    <div className="text-left">
                                                        <div className="text-xs text-white font-mono truncate max-w-[180px]">
                                                            {newPresetFile?.name || 'Image Selected'}
                                                        </div>
                                                        <div className="text-[10px] text-emerald-400 font-mono">Click to change image</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-xs font-mono text-gray-300">
                                                    <Upload size={14} className="text-emerald-400" />
                                                    Select Stair or Deck Photo
                                                </div>
                                            )}
                                        </label>

                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="col-span-2">
                                                <input
                                                    type="text"
                                                    value={newPresetName}
                                                    onChange={(e) => setNewPresetName(e.target.value)}
                                                    placeholder="Preset Name (e.g. Back Deck)"
                                                    className="w-full bg-black/60 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white placeholder-gray-500 font-mono focus:outline-none focus:border-emerald-500/50"
                                                />
                                            </div>
                                            <div>
                                                <select
                                                    value={newPresetCategory}
                                                    onChange={(e) => setNewPresetCategory(e.target.value as 'Interior' | 'Exterior')}
                                                    className="w-full bg-black/60 border border-white/10 rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500/50"
                                                >
                                                    <option value="Interior">Interior</option>
                                                    <option value="Exterior">Exterior</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsAddingPreset(false);
                                                    setNewPresetDataUrl(null);
                                                    setNewPresetFile(null);
                                                    setNewPresetName('');
                                                }}
                                                className="px-2.5 py-1 rounded bg-black/40 hover:bg-black/60 text-gray-400 hover:text-white text-xs font-mono border border-white/10 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                disabled={!newPresetDataUrl || !newPresetName.trim() || isSavingPreset}
                                                onClick={handleSubmitNewPreset}
                                                className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-mono font-bold transition-colors flex items-center gap-1"
                                            >
                                                {isSavingPreset ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                                Save Preset
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Preset Scenes Grid */}
                            <div className="grid grid-cols-2 gap-2">
                                {allPresets.map((preset) => (
                                    <div
                                        key={preset.id}
                                        className="relative group"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleSelectPreset(preset)}
                                            className={`w-full p-2 rounded-lg border text-left transition-all flex items-center gap-2.5 ${
                                                selectedPresetId === preset.id
                                                    ? 'bg-emerald-950/40 border-emerald-500/60 text-white shadow-sm'
                                                    : 'bg-black/50 border-white/5 text-gray-400 hover:text-white hover:border-white/20'
                                            }`}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={preset.url}
                                                alt={preset.name}
                                                className="w-10 h-10 rounded object-cover shrink-0 bg-neutral-900 border border-white/10"
                                            />
                                            <div className="overflow-hidden pr-3">
                                                <div className="text-xs font-semibold truncate">{preset.name}</div>
                                                <div className="text-[10px] text-gray-500 flex items-center gap-1.5">
                                                    <span>{preset.category}</span>
                                                    {!preset.isDefault && (
                                                        <span className="bg-emerald-500/20 text-emerald-300 text-[9px] px-1 rounded font-mono">
                                                            Custom
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>

                                        {/* Delete Custom Preset Button */}
                                        {!preset.isDefault && (
                                            <button
                                                type="button"
                                                title="Delete this custom preset"
                                                onClick={(e) => handleDeleteCustomPreset(preset.id, e)}
                                                className="absolute top-1.5 right-1.5 p-1 rounded bg-black/80 hover:bg-red-950 text-gray-400 hover:text-red-400 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Or Upload Custom Image (One-Off) */}
                        <div>
                            <label className="text-xs font-mono uppercase text-gray-400 block mb-2">Or Upload Scene Photo (One-Off):</label>
                            <label className="flex flex-col items-center justify-center border border-dashed border-white/20 hover:border-emerald-500/50 rounded-lg p-4 cursor-pointer bg-black/30 hover:bg-black/60 transition-all text-center group">
                                <input
                                    type="file"
                                    accept="image/*,.heic"
                                    onChange={handleCustomSceneUpload}
                                    className="hidden"
                                />
                                {loadingScene ? (
                                    <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono py-2">
                                        <Loader2 size={16} className="animate-spin" /> Processing image...
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <Upload size={18} className="text-gray-500 group-hover:text-emerald-400 transition-colors" />
                                        <span className="text-xs text-gray-300 group-hover:text-white transition-colors font-mono">
                                            {sceneFile ? sceneFile.name : 'Upload Stairs, Porch, or Deck Photo'}
                                        </span>
                                    </div>
                                )}
                            </label>

                            {/* Option to Save One-Off Uploaded Photo to Reusable Presets */}
                            {sceneFile && uploadedDataUrl && (
                                <div className="flex items-center justify-between bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-2.5 mt-2">
                                    <span className="text-[11px] text-gray-300 font-mono truncate max-w-[200px]">
                                        {sceneFile.name}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const defaultSuggestedName = sceneFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
                                            const promptName = window.prompt('Enter a title for this preset scene:', defaultSuggestedName);
                                            if (promptName && promptName.trim()) {
                                                saveCustomPreset(promptName, 'Exterior', uploadedDataUrl);
                                            }
                                        }}
                                        className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/30 px-2 py-1 rounded font-mono transition-colors"
                                    >
                                        <BookmarkPlus size={13} /> Save as Preset Scene
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* STEP 2: TENANT STYLE SELECTION */}
                    <div className="bg-[#111] border border-white/10 rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                            <div className="flex items-center gap-2 font-bold text-white text-sm uppercase tracking-wide font-mono">
                                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">2</span>
                                Select Tenant Style to Test
                            </div>
                            <span className="text-[10px] font-mono text-gray-500">
                                {initialStyles.length} Styles Found
                            </span>
                        </div>

                        {initialStyles.length === 0 ? (
                            <div className="p-6 text-center border border-white/5 rounded-lg bg-black/30 space-y-3">
                                <p className="text-xs text-gray-400">This tenant does not have any styles saved yet.</p>
                                <Link
                                    href={`/admin/tenants/${tenantId}/styles`}
                                    className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-wider font-mono underline"
                                >
                                    <Palette size={14} /> Add Styles to Tenant Portfolio
                                </Link>
                                <div className="text-[10px] text-gray-600">You can also test with a custom style image below.</div>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                                {initialStyles.map((style) => {
                                    const isSelected = selectedStyleId === style.id;
                                    const refCount = (style.reference_images || []).length;

                                    return (
                                        <div
                                            key={style.id}
                                            onClick={() => setSelectedStyleId(style.id)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                                                isSelected
                                                    ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-lg'
                                                    : 'bg-black/40 border-white/5 text-gray-300 hover:border-white/20'
                                            }`}
                                        >
                                            <div className="w-14 h-14 rounded-md overflow-hidden bg-gray-900 border border-white/10 shrink-0 relative">
                                                {style.image_url ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={style.image_url} alt={style.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                                                        <ImageIcon size={18} />
                                                    </div>
                                                )}
                                                {refCount > 0 && (
                                                    <span className="absolute bottom-0 right-0 bg-black/80 text-[9px] font-mono text-emerald-400 px-1 rounded-tl">
                                                        +{refCount}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-bold text-sm truncate">{style.name}</span>
                                                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                                                        style.is_active
                                                            ? 'bg-green-900/20 text-green-400 border-green-800/40'
                                                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                                    }`}>
                                                        {style.is_active ? 'Active' : 'Draft'}
                                                    </span>
                                                </div>

                                                <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">
                                                    {style.description || 'No description provided.'}
                                                </p>

                                                <div className="flex items-center gap-2 mt-2 text-[10px] font-mono text-gray-500">
                                                    <span>{style.has_bottom_rail ? 'Shoe Rail' : 'Direct Mount'}</span>
                                                    <span>•</span>
                                                    <span>{style.has_reducers === true ? 'With Reducers' : style.has_reducers === false ? 'No Reducers' : 'Reducers: Default'}</span>
                                                    {style.price_per_ft_min && (
                                                        <>
                                                            <span>•</span>
                                                            <span>${style.price_per_ft_min}-${style.price_per_ft_max}/ft</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Test with Custom Reference Photo */}
                        <div className="pt-2 border-t border-white/5">
                            <div
                                onClick={() => setSelectedStyleId('custom')}
                                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                    selectedStyleId === 'custom'
                                        ? 'bg-emerald-950/40 border-emerald-500 text-white'
                                        : 'bg-black/30 border-dashed border-white/10 hover:border-white/20 text-gray-400'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-mono uppercase font-bold flex items-center gap-2">
                                        <Layers size={14} className="text-emerald-400" />
                                        Test Custom Style Image (On-the-Fly)
                                    </div>
                                    {selectedStyleId === 'custom' && (
                                        <Check size={14} className="text-emerald-400" />
                                    )}
                                </div>

                                {selectedStyleId === 'custom' && (
                                    <div className="mt-3 space-y-2">
                                        <label className="flex items-center justify-center p-3 border border-dashed border-white/20 rounded cursor-pointer bg-black hover:border-emerald-500 transition-colors">
                                            <input
                                                type="file"
                                                accept="image/*,.heic"
                                                onChange={handleCustomStyleUpload}
                                                className="hidden"
                                            />
                                            <div className="text-xs font-mono text-gray-300 flex items-center gap-2">
                                                <Upload size={14} />
                                                {customStyleFile ? customStyleFile.name : 'Upload Reference Railing Photo'}
                                            </div>
                                        </label>
                                        {customStylePreview && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={customStylePreview} alt="Custom Style" className="w-20 h-20 rounded object-cover border border-white/10 mt-2" />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* STEP 3: TROUBLESHOOTING & SPECS (COLLAPSIBLE) */}
                    <div className="bg-[#111] border border-white/10 rounded-xl p-5 space-y-3">
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="w-full flex items-center justify-between text-xs font-mono uppercase text-gray-400 hover:text-white transition-colors"
                        >
                            <span className="flex items-center gap-2 font-bold">
                                <Sliders size={14} className="text-emerald-400" />
                                Troubleshooting & Spec Overrides
                            </span>
                            <span>{showAdvanced ? '▲ Hide' : '▼ Show'}</span>
                        </button>

                        {showAdvanced && (
                            <div className="space-y-4 pt-3 border-t border-white/5 text-xs font-mono">
                                <div>
                                    <label className="text-gray-400 block mb-1">Bottom Rail Setting Override:</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'default', label: 'Use Style Default' },
                                            { id: 'with_rail', label: 'Force Shoe Rail' },
                                            { id: 'without_rail', label: 'Force Direct Mount' }
                                        ].map((opt) => (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => setBottomRailOverride(opt.id as any)}
                                                className={`p-2 rounded border text-center transition-all ${
                                                    bottomRailOverride === opt.id
                                                        ? 'bg-emerald-950/60 border-emerald-500 text-white font-bold'
                                                        : 'bg-black/50 border-white/10 text-gray-400 hover:text-white'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-gray-400 block mb-1">Post-to-Rail Reducers Override:</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'default', label: 'Use Style Default' },
                                            { id: 'without_reducers', label: 'Force Direct (No Reducers)' },
                                            { id: 'with_reducers', label: 'Force Reducers' }
                                        ].map((opt) => (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => setReducerOverride(opt.id as any)}
                                                className={`p-2 rounded border text-center transition-all ${
                                                    reducerOverride === opt.id
                                                        ? 'bg-emerald-950/60 border-emerald-500 text-white font-bold'
                                                        : 'bg-black/50 border-white/10 text-gray-400 hover:text-white'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-gray-400 block mb-1">Custom Prompt Guidance (Optional):</label>
                                    <input
                                        type="text"
                                        value={customPromptNote}
                                        onChange={(e) => setCustomPromptNote(e.target.value)}
                                        placeholder="e.g. Ensure spindles terminate into landing, dark bronze finish"
                                        className="w-full bg-black border border-white/10 p-2.5 rounded text-white outline-none focus:border-emerald-500"
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">Useful when troubleshooting why an AI render may not follow subtle shop details.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ERROR DISPLAY */}
                    {error && (
                        <div className="bg-red-950/40 border border-red-500/40 text-red-300 p-4 rounded-xl text-xs font-mono flex items-start gap-3">
                            <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                            <div>
                                <strong className="font-bold block mb-1">Generation Failed</strong>
                                <span>{error}</span>
                            </div>
                        </div>
                    )}

                    {/* GENERATE BUTTON */}
                    <button
                        type="button"
                        onClick={handleRunTest}
                        disabled={isGenerating}
                        className={`w-full py-4 rounded-xl font-bold uppercase tracking-wider font-mono text-sm flex items-center justify-center gap-2 transition-all shadow-xl ${
                            isGenerating
                                ? 'bg-emerald-900/50 text-emerald-300 cursor-not-allowed border border-emerald-800/40'
                                : 'bg-emerald-500 hover:bg-emerald-400 text-black hover:shadow-emerald-500/20 hover:shadow-2xl'
                        }`}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 size={18} className="animate-spin text-emerald-300" />
                                Rendering Scene with AI ($0.00)...
                            </>
                        ) : (
                            <>
                                <Sparkles size={18} />
                                Run Zero-Charge Test ($0.00)
                            </>
                        )}
                    </button>
                </div>

                {/* RIGHT COLUMN: PREVIEW & RESULT VIEWER (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-[#111] border border-white/10 rounded-xl p-5 flex flex-col h-full min-h-[580px]">
                        {/* VIEWER HEADER */}
                        <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                            <div className="flex items-center gap-3">
                                <h3 className="font-bold text-white uppercase font-mono text-sm tracking-wide">
                                    Visualizer Preview & Comparison
                                </h3>
                                {resultImage && (
                                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold flex items-center gap-1">
                                        <Check size={10} /> Test Passed
                                    </span>
                                )}
                            </div>

                            {/* View mode toggle */}
                            {resultImage && (
                                <div className="flex items-center gap-1 bg-black/60 border border-white/10 rounded p-1 text-xs font-mono">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('side-by-side')}
                                        className={`px-2.5 py-1 rounded transition-colors ${
                                            viewMode === 'side-by-side' ? 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/30' : 'text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        Side-by-Side
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('result-only')}
                                        className={`px-2.5 py-1 rounded transition-colors ${
                                            viewMode === 'result-only' ? 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/30' : 'text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        Result
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('scene-only')}
                                        className={`px-2.5 py-1 rounded transition-colors ${
                                            viewMode === 'scene-only' ? 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/30' : 'text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        Original
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* DISPLAY AREA */}
                        <div className="flex-1 bg-black rounded-lg border border-white/5 overflow-hidden flex items-center justify-center p-4 relative min-h-[420px]">
                            {isGenerating ? (
                                <div className="text-center space-y-4">
                                    <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin mx-auto" />
                                    <div className="text-emerald-400 font-mono text-sm animate-pulse tracking-wide font-bold">
                                        SYNTHESIZING TENANT STYLE...
                                    </div>
                                    <p className="text-xs text-gray-500 font-mono max-w-sm">
                                        Multi-shot Nano Banana model analyzing staircase geometry and applying {selectedStyleObj?.name || 'custom'} specifications.
                                    </p>
                                </div>
                            ) : resultImage ? (
                                <div className="w-full h-full flex flex-col items-center justify-center">
                                    {viewMode === 'side-by-side' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full">
                                            {/* Original Scene */}
                                            <div className="relative rounded-lg overflow-hidden border border-white/10 group bg-zinc-950 flex flex-col">
                                                <div className="absolute top-2 left-2 z-10 bg-black/80 text-gray-300 px-2.5 py-1 rounded text-[10px] font-mono uppercase font-bold border border-white/10">
                                                    Original Scene
                                                </div>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={scenePreview || ''}
                                                    alt="Original Scene"
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>

                                            {/* Generated Visualizer Result */}
                                            <div className="relative rounded-lg overflow-hidden border border-emerald-500/40 group bg-zinc-950 flex flex-col shadow-2xl">
                                                <div className="absolute top-2 left-2 z-10 bg-emerald-950/90 text-emerald-300 px-2.5 py-1 rounded text-[10px] font-mono uppercase font-bold border border-emerald-500/40 flex items-center gap-1.5">
                                                    <Sparkles size={11} /> AI Visualizer Result
                                                </div>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={resultImage}
                                                    alt="Generated Handrail"
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>
                                        </div>
                                    ) : viewMode === 'result-only' ? (
                                        <div className="w-full h-full relative flex items-center justify-center">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={resultImage}
                                                alt="Generated Handrail"
                                                className="max-h-[500px] w-auto object-contain rounded-lg border border-emerald-500/40 shadow-2xl"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-full h-full relative flex items-center justify-center">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={scenePreview || ''}
                                                alt="Original Scene"
                                                className="max-h-[500px] w-auto object-contain rounded-lg border border-white/10"
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : scenePreview ? (
                                <div className="text-center space-y-4">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={scenePreview}
                                        alt="Scene Preview"
                                        className="max-h-[360px] w-auto object-contain rounded-lg border border-white/10 mx-auto shadow-xl"
                                    />
                                    <p className="text-xs font-mono text-gray-500">
                                        Scene ready. Select a style on the left and click <strong>Run Zero-Charge Test</strong>.
                                    </p>
                                </div>
                            ) : (
                                <div className="text-center space-y-2 text-gray-500 font-mono text-xs">
                                    <ImageIcon size={32} className="mx-auto text-gray-700 mb-2" />
                                    <p>Select a preset scene or upload a stairs photo to start testing.</p>
                                </div>
                            )}
                        </div>

                        {/* DIAGNOSTICS & ACTIONS FOOTER */}
                        {resultImage && (
                            <div className="mt-4 pt-4 border-t border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs font-mono">
                                <div className="space-y-1 text-gray-400">
                                    <div className="flex items-center gap-3">
                                        <span>Style: <strong className="text-white">{diagnostics?.styleUsed?.name || 'Custom'}</strong></span>
                                        {diagnostics?.durationMs && (
                                            <span>Duration: <strong className="text-emerald-400">{(diagnostics.durationMs / 1000).toFixed(1)}s</strong></span>
                                        )}
                                        <span className="text-emerald-400 font-bold">• Tenant Charge: $0.00</span>
                                    </div>
                                    <div className="text-[10px] text-gray-500">
                                        Bypassed Stripe & profile counters. No usage added to tenant invoice.
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <a
                                        href={resultImage}
                                        download={`test-${tenantId}-${Date.now()}.png`}
                                        className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded text-xs font-mono uppercase font-bold flex items-center gap-1.5 transition-colors"
                                    >
                                        <Download size={14} /> Download
                                    </a>
                                    <button
                                        type="button"
                                        onClick={handleRunTest}
                                        disabled={isGenerating}
                                        className="bg-emerald-950 border border-emerald-500/40 hover:bg-emerald-900 text-emerald-300 px-3 py-2 rounded text-xs font-mono uppercase font-bold flex items-center gap-1.5 transition-colors"
                                    >
                                        <RefreshCw size={14} /> Re-test
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
