/**
 * Centralized Model Pricing Catalog & Cost Calculator (November 2026 Rates)
 *
 * Used by both generation logging (src/app/actions/ai.ts, src/lib/vertex.ts)
 * and the Admin Cost Intelligence dashboard (src/app/admin/actions.ts,
 * src/app/admin/costs/page.tsx).
 */

export type ImageOutputSize = '1K' | '2K' | '4K';

export interface ModelPricingSpec {
    id: string;
    displayName: string;
    family: 'image' | 'vision' | 'legacy';
    inputPer1MUsd: number;
    textOutputPer1MUsd: number;
    imageOutputPer1MUsd?: number;
    perImageUsd?: Partial<Record<ImageOutputSize, number>>;
    defaultImageSize?: ImageOutputSize;
    notes: string;
}

export const MODEL_PRICING_CATALOG: Record<string, ModelPricingSpec> = {
    'gemini-nano-banana-2.1': {
        id: 'gemini-nano-banana-2.1',
        displayName: 'Gemini Nano Banana 2.1',
        family: 'image',
        inputPer1MUsd: 1.50,
        textOutputPer1MUsd: 7.50,
        imageOutputPer1MUsd: 30.00,
        perImageUsd: {
            '1K': 0.0336,
            '2K': 0.0504,
            '4K': 0.113,
        },
        defaultImageSize: '2K',
        notes: 'Primary production railing renderer (default 2K output + MEDIUM thinking).',
    },
    'gemini-3-pro-image': {
        id: 'gemini-3-pro-image',
        displayName: 'Gemini 3 Pro Image',
        family: 'image',
        inputPer1MUsd: 2.00,
        textOutputPer1MUsd: 12.00,
        perImageUsd: {
            '1K': 0.134,
            '2K': 0.134,
            '4K': 0.24,
        },
        defaultImageSize: '2K',
        notes: 'High-cost Pro image tier.',
    },
    'gemini-3.8-flash': {
        id: 'gemini-3.8-flash',
        displayName: 'Gemini 3.8 Flash',
        family: 'vision',
        inputPer1MUsd: 0.75,
        textOutputPer1MUsd: 3.75,
        notes: 'Scene Router, Style Photo Validator, Fab-Spec Extractor, and Agentic Vision QA (introductory pricing through Dec 31, 2026).',
    },
    'gemini-3.5-flash-lite': {
        id: 'gemini-3.5-flash-lite',
        displayName: 'Gemini 3.5 Flash-Lite',
        family: 'vision',
        inputPer1MUsd: 0.25,
        textOutputPer1MUsd: 1.50,
        notes: 'High-throughput fallback vision/routing model.',
    },
    'gemini-4-argon': {
        id: 'gemini-4-argon',
        displayName: 'Gemini 4 Argon',
        family: 'vision',
        inputPer1MUsd: 2.00,
        textOutputPer1MUsd: 12.00,
        notes: 'Frontier reasoning model for complex architecture/prompt R&D.',
    },
    // Legacy models preserved for accurate historical ledger reporting
    'gemini-3.1-flash-image': {
        id: 'gemini-3.1-flash-image',
        displayName: 'Gemini 3.1 Flash Image (Legacy)',
        family: 'legacy',
        inputPer1MUsd: 0.15,
        textOutputPer1MUsd: 0.60,
        perImageUsd: {
            '1K': 0.030,
            '2K': 0.045,
            '4K': 0.067,
        },
        defaultImageSize: '1K',
        notes: 'Deprecated image model previously used in production.',
    },
    'gemini-3.1-flash-lite': {
        id: 'gemini-3.1-flash-lite',
        displayName: 'Gemini 3.1 Flash-Lite (Legacy)',
        family: 'legacy',
        inputPer1MUsd: 0.075,
        textOutputPer1MUsd: 0.30,
        notes: 'Deprecated lightweight text/vision router.',
    },
    'gemini-3.0-pro': {
        id: 'gemini-3.0-pro',
        displayName: 'Gemini 3.0 Pro (Legacy)',
        family: 'legacy',
        inputPer1MUsd: 2.00,
        textOutputPer1MUsd: 12.00,
        perImageUsd: {
            '1K': 0.134,
            '2K': 0.134,
            '4K': 0.24,
        },
        defaultImageSize: '1K',
        notes: 'Deprecated Gemini 3 Pro generation model.',
    },
    'imagen-3.0-capability-001': {
        id: 'imagen-3.0-capability-001',
        displayName: 'Imagen 3 Capability (Removed)',
        family: 'legacy',
        inputPer1MUsd: 0,
        textOutputPer1MUsd: 0,
        perImageUsd: {
            '1K': 0.040,
            '2K': 0.040,
        },
        defaultImageSize: '1K',
        notes: 'Removed legacy subject-customization pipeline.',
    },
};

const STANDARD_IMAGE_TOKENS: Record<ImageOutputSize, number> = {
    '1K': 1120,
    '2K': 1680,
    '4K': 3767,
};

export interface ModelCostInput {
    modelId: string;
    inputTokens?: number;
    outputTokens?: number;
    textOutputTokens?: number;
    thinkingTokens?: number;
    imageOutputTokens?: number;
    imageCount?: number;
    imageSize?: ImageOutputSize;
}

/**
 * Resolves a raw Vertex/Gemini model string (including versioned suffixes)
 * to a canonical pricing entry in MODEL_PRICING_CATALOG.
 */
export function resolvePricingSpec(modelId: string): ModelPricingSpec {
    const normalized = (modelId || '').toLowerCase().trim();
    if (!normalized) {
        return MODEL_PRICING_CATALOG['gemini-nano-banana-2.1'];
    }
    if (MODEL_PRICING_CATALOG[normalized]) {
        return MODEL_PRICING_CATALOG[normalized];
    }
    if (normalized.includes('nano-banana-2.1') || normalized.includes('nano-banana')) {
        return MODEL_PRICING_CATALOG['gemini-nano-banana-2.1'];
    }
    if (normalized.includes('3.8-flash')) {
        return MODEL_PRICING_CATALOG['gemini-3.8-flash'];
    }
    if (normalized.includes('4-argon') || normalized.includes('argon')) {
        return MODEL_PRICING_CATALOG['gemini-4-argon'];
    }
    if (normalized.includes('3-pro-image') || normalized.includes('gemini-3.0-pro-image')) {
        return MODEL_PRICING_CATALOG['gemini-3-pro-image'];
    }
    if (normalized.includes('3.1-flash-lite')) {
        return MODEL_PRICING_CATALOG['gemini-3.1-flash-lite'];
    }
    if (normalized.includes('3.1-flash-image') || normalized.includes('flash-image')) {
        return MODEL_PRICING_CATALOG['gemini-3.1-flash-image'];
    }
    if (normalized.includes('gemini-3')) {
        return MODEL_PRICING_CATALOG['gemini-3.0-pro'];
    }
    if (normalized.includes('imagen')) {
        return MODEL_PRICING_CATALOG['imagen-3.0-capability-001'];
    }
    return MODEL_PRICING_CATALOG['gemini-nano-banana-2.1'];
}

/**
 * Calculates exact USD cost for a single model invocation.
 * Avoids double-counting image output tokens when callers pass combined
 * `outputTokens` (Vertex `candidatesTokenCount` often includes ~1,680 image
 * tokens for 2K Nano Banana 2.1 output).
 */
export function calculateGenerationCostUsd(params: ModelCostInput): number {
    const spec = resolvePricingSpec(params.modelId);
    const inputTokens = Math.max(0, Number(params.inputTokens) || 0);
    const totalOutputTokens = Math.max(0, Number(params.outputTokens) || 0);
    const imageSize: ImageOutputSize = params.imageSize || spec.defaultImageSize || '2K';
    const isImageModel = Boolean(spec.perImageUsd || spec.imageOutputPer1MUsd);
    const imageCount =
        params.imageCount !== undefined
            ? Math.max(0, Number(params.imageCount) || 0)
            : isImageModel
              ? 1
              : 0;

    const inputCost = (inputTokens / 1_000_000) * spec.inputPer1MUsd;

    let imageCost = 0;
    if (imageCount > 0) {
        if (params.imageOutputTokens !== undefined && spec.imageOutputPer1MUsd) {
            imageCost = (Math.max(0, params.imageOutputTokens) / 1_000_000) * spec.imageOutputPer1MUsd;
        } else {
            const unitImageCost =
                spec.perImageUsd?.[imageSize] ??
                spec.perImageUsd?.['2K'] ??
                spec.perImageUsd?.['1K'] ??
                0;
            imageCost = imageCount * unitImageCost;
        }
    }

    let billableTextTokens = 0;
    if (params.textOutputTokens !== undefined || params.thinkingTokens !== undefined) {
        billableTextTokens =
            Math.max(0, Number(params.textOutputTokens) || 0) +
            Math.max(0, Number(params.thinkingTokens) || 0);
    } else if (imageCount > 0 && spec.id === 'gemini-nano-banana-2.1') {
        // When Vertex bundles image output tokens into candidatesTokenCount, subtract
        // the nominal image token footprint so image tokens are not billed twice.
        const approxImageTokens =
            params.imageOutputTokens ?? STANDARD_IMAGE_TOKENS[imageSize] * imageCount;
        billableTextTokens =
            totalOutputTokens >= approxImageTokens
                ? totalOutputTokens - approxImageTokens
                : totalOutputTokens;
    } else {
        billableTextTokens = totalOutputTokens;
    }

    const textCost = (billableTextTokens / 1_000_000) * spec.textOutputPer1MUsd;
    return Number((inputCost + textCost + imageCost).toFixed(6));
}

export interface HistoricalGenerationRow {
    cost_usd?: number | string | null;
    model_id?: string | null;
    input_tokens?: number | string | null;
    output_tokens?: number | string | null;
}

/**
 * Computes USD cost for historical database ledger rows.
 * Prefers persisted `cost_usd` written at generation time, falling back to
 * model-accurate rate estimation when absent.
 */
export function computeHistoricalGenerationCost(gen: HistoricalGenerationRow): number {
    if (gen.cost_usd !== undefined && gen.cost_usd !== null && gen.cost_usd !== '') {
        const parsed = Number(gen.cost_usd);
        if (Number.isFinite(parsed) && parsed >= 0) {
            return parsed;
        }
    }

    const modelId = gen.model_id || '';
    const lower = modelId.toLowerCase();
    const inputTokens = Math.max(0, Number(gen.input_tokens) || 0);
    const outputTokens = Math.max(0, Number(gen.output_tokens) || 0);

    // Vision-only calls (3.8-flash, 3.1-flash-lite) have imageCount=0.
    const isVisionOnly =
        lower.includes('3.8-flash') ||
        lower.includes('flash-lite') ||
        lower.includes('argon') ||
        (lower.includes('flash') && !lower.includes('image'));

    return calculateGenerationCostUsd({
        modelId: modelId || 'gemini-3.1-flash-image',
        inputTokens,
        outputTokens,
        imageCount: isVisionOnly ? 0 : 1,
        imageSize: lower.includes('nano-banana-2.1') ? '2K' : '1K',
    });
}
