import clsx from 'clsx';
import { Upload, Check } from 'lucide-react';
import { compressImage } from '@/utils/imageUtils';

export default function StyleControls({
    styleSource,
    setStyleSource,
    styles,
    selectedStyleIndex,
    setSelectedStyleIndex,
    customStyleFile,
    setCustomStyleFile,
    error,
    logo
}: {
    styleSource: 'preset' | 'upload',
    setStyleSource: (s: 'preset' | 'upload') => void,
    styles: any[],
    selectedStyleIndex: number,
    setSelectedStyleIndex: (i: number) => void,
    customStyleFile: File | null,
    setCustomStyleFile: (f: File | null) => void,
    error: string | null,
    logo?: string | null
}) {
    // Shared compression helper or pass it down
    const handleStyleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const compressed = await compressImage(e.target.files[0]);
                setCustomStyleFile(compressed);
            } catch (err) {
                console.error("Style compression failed", err);
                // In a real app we'd bubble this error up
            }
        }
    };

    return (
        <div>
            {/* Style Source Toggle */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => setStyleSource('preset')}
                    className={clsx(
                        "flex-1 md:flex-none px-6 py-3 rounded-full text-sm font-bold uppercase tracking-wider transition-all",
                        styleSource === 'preset'
                            ? "bg-[var(--primary)] text-black"
                            : "bg-gray-900 text-gray-400 hover:bg-gray-800"
                    )}
                >
                    Choose Preset
                </button>
                <button
                    onClick={() => setStyleSource('upload')}
                    className={clsx(
                        "flex-1 md:flex-none px-6 py-3 rounded-full text-sm font-bold uppercase tracking-wider transition-all",
                        styleSource === 'upload'
                            ? "bg-[var(--primary)] text-black"
                            : "bg-gray-900 text-gray-400 hover:bg-gray-800"
                    )}
                >
                    Custom Ref
                </button>
            </div>

            {styleSource === 'preset' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {styles.map((style, index) => (
                        <div
                            key={style.id}
                            onClick={() => setSelectedStyleIndex(index)}
                            className={clsx(
                                "relative p-4 md:p-6 rounded-xl border-2 cursor-pointer transition-all duration-300 group overflow-hidden select-none",
                                selectedStyleIndex === index
                                    ? "border-[var(--primary)] bg-[var(--primary)]/5 shadow-[0_0_20px_-10px_var(--primary)]"
                                    : "border-[var(--secondary)] hover:border-gray-500 bg-[#111]"
                            )}
                        >
                            <div className="flex justify-between items-center mb-2 md:mb-4 relative z-10">
                                <h3 className={clsx("text-lg md:text-xl font-bold uppercase", selectedStyleIndex === index ? "text-[var(--primary)]" : "text-white")}>
                                    {style.name}
                                </h3>
                                {selectedStyleIndex === index && (
                                    <div className="bg-[var(--primary)] text-black rounded-full p-1 shrink-0">
                                        <Check className="w-4 h-4" />
                                    </div>
                                )}
                            </div>
                            <p className="text-gray-400 text-xs md:text-sm leading-relaxed relative z-10 line-clamp-2 md:line-clamp-none">
                                {style.description}
                            </p>

                            {/* Background decoration */}
                            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-gradient-to-tl from-white/5 to-transparent rounded-full blur-2xl group-hover:from-white/10 transition-colors" />


                        </div>
                    ))}
                </div>
            ) : (
                <div className="mb-8 p-8 border border-dashed border-gray-700 rounded-xl bg-[#111] text-center">
                    {customStyleFile ? (
                        <div className="relative group max-w-sm mx-auto">
                            <img
                                src={URL.createObjectURL(customStyleFile)}
                                alt="Style Reference"
                                className="w-full rounded-lg"
                            />
                            <button
                                onClick={() => setCustomStyleFile(null)}
                                className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold"
                            >
                                REMOVE IMAGE
                            </button>
                        </div>
                    ) : (
                        <div className="py-8">
                            <div className="w-16 h-16 mx-auto bg-gray-900 rounded-full flex items-center justify-center mb-4 text-[var(--primary)]">
                                <Upload className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Upload Style Reference</h3>
                            <p className="text-gray-500 mb-6 max-w-md mx-auto">
                                Upload a photo of a railing or staircase you love.
                            </p>
                            <label className="btn-primary inline-flex items-center gap-2 cursor-pointer px-6 py-3 rounded-lg bg-[var(--primary)] text-black font-bold hover:bg-yellow-400 transition-colors">
                                <span>Select Image</span>
                                <input
                                    type="file"
                                    onChange={handleStyleUpload}
                                    className="hidden"
                                    accept=".jpg,.jpeg,.png,.webp"
                                />
                            </label>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
