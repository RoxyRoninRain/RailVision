'use client';

import { useCallback, useRef, useState } from 'react';
import { MoveHorizontal } from 'lucide-react';

interface BeforeAfterSliderProps {
    beforeImage: string;
    afterImage: string;
    beforeLabel?: string;
    afterLabel?: string;
    className?: string;
}

/**
 * Interactive pointer/touch before-and-after wipe slider for comparing the
 * customer's original staircase photo against the generated 2K railing design.
 */
export default function BeforeAfterSlider({
    beforeImage,
    afterImage,
    beforeLabel = 'Original Before',
    afterLabel = 'New Design (2K)',
    className = '',
}: BeforeAfterSliderProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [position, setPosition] = useState<number>(62);
    const [isDragging, setIsDragging] = useState<boolean>(false);

    const updateFromClientX = useCallback((clientX: number) => {
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0) return;
        const pct = ((clientX - rect.left) / rect.width) * 100;
        setPosition(Math.max(2, Math.min(98, pct)));
    }, []);

    return (
        <div
            ref={containerRef}
            onPointerDown={(e) => {
                setIsDragging(true);
                (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
                updateFromClientX(e.clientX);
            }}
            onPointerMove={(e) => {
                if (isDragging) updateFromClientX(e.clientX);
            }}
            onPointerUp={() => setIsDragging(false)}
            onPointerCancel={() => setIsDragging(false)}
            className={`relative select-none touch-none overflow-hidden rounded-3xl border border-[#333] shadow-2xl bg-black cursor-ew-resize ${className}`}
            role="slider"
            aria-label="Before and after comparison slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(position)}
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') setPosition((p) => Math.max(2, p - 4));
                if (e.key === 'ArrowRight') setPosition((p) => Math.min(98, p + 4));
            }}
        >
            {/* Full After Image (Right / Base Layer) */}
            <img
                src={afterImage}
                alt={afterLabel}
                draggable={false}
                className="block w-full h-full object-contain max-h-[58vh] pointer-events-none"
            />

            {/* Clipped Before Image Overlay (Left Layer) */}
            <img
                src={beforeImage}
                alt={beforeLabel}
                draggable={false}
                style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
                className="absolute inset-0 w-full h-full object-contain max-h-[58vh] pointer-events-none"
            />

            {/* Labels */}
            <span className="absolute top-4 left-4 z-20 px-3 py-1 rounded-full bg-black/75 border border-white/20 text-[11px] font-mono font-bold uppercase text-white pointer-events-none backdrop-blur-md">
                {beforeLabel}
            </span>
            <span className="absolute top-4 right-4 z-20 px-3 py-1 rounded-full bg-black/75 border border-white/20 text-[11px] font-mono font-bold uppercase text-[var(--primary)] pointer-events-none backdrop-blur-md">
                {afterLabel}
            </span>

            {/* Draggable Vertical Handle */}
            <div
                style={{ left: `${position}%` }}
                className="absolute inset-y-0 z-30 w-0.5 bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.8)] pointer-events-none"
            >
                <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[var(--primary)] text-black border-2 border-white shadow-xl flex items-center justify-center">
                    <MoveHorizontal size={18} strokeWidth={2.5} />
                </div>
            </div>
        </div>
    );
}
