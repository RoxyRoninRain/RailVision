import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';
import {
    calculateGenerationCostUsd,
    computeHistoricalGenerationCost,
    MODEL_PRICING_CATALOG,
} from '@/lib/model-pricing';
import {
    buildFabSpecExtractorPrompt,
    buildPhotoValidatorPrompt,
    buildRailingSynthesisPrompts,
    buildVisionQaPrompt,
} from '@/lib/prompts';
import {
    MAX_FREE_CALIBRATION_RENDERS,
    MAX_WIZARD_TOTAL_PHOTOS,
    MIN_WIZARD_REQUIRED_SLOTS,
    STYLE_PHOTO_SLOTS,
} from '@/app/actions/types';
import { applyServerWatermark, pixelLockCompositeBackground } from '@/lib/image-compositor';

const TINY_VALID_JPEG = Buffer.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00,
    0x10, 0x00, 0x10, 0x01, 0x01, 0x11, 0x00, 0xff,
    0xd9,
]);

describe('Phase 1 — Model Pricing & Cost Intelligence Catalog', () => {
    it('calculates Nano Banana 2.1 costs without double-counting 2K image output tokens', () => {
        // 10k input @ $1.50/1M = $0.015
        // 1680 image tokens + 200 text/thinking tokens = 1880 outputTokens
        // Only the 200 text/thinking tokens bill at $7.50/1M ($0.0015), plus $0.0504 for 2K image
        const cost = calculateGenerationCostUsd({
            modelId: 'gemini-nano-banana-2.1',
            inputTokens: 10_000,
            outputTokens: 1880,
            imageSize: '2K',
            imageCount: 1,
        });
        expect(cost).toBeCloseTo(0.015 + 0.0015 + 0.0504, 5);
    });

    it('calculates 1K and 4K Nano Banana 2.1 image tiers and Gemini 3.8 Flash vision costs', () => {
        const cost1K = calculateGenerationCostUsd({
            modelId: 'gemini-nano-banana-2.1',
            inputTokens: 0,
            outputTokens: 1120,
            imageSize: '1K',
        });
        const cost4K = calculateGenerationCostUsd({
            modelId: 'gemini-nano-banana-2.1',
            inputTokens: 0,
            outputTokens: 3767,
            imageSize: '4K',
        });
        const visionCost = calculateGenerationCostUsd({
            modelId: 'gemini-3.8-flash',
            inputTokens: 1_000_000,
            outputTokens: 1_000_000,
            imageCount: 0,
        });

        expect(cost1K).toBeCloseTo(0.0336, 4);
        expect(cost4K).toBeCloseTo(0.113, 3);
        expect(visionCost).toBeCloseTo(4.5, 4);
        expect(MODEL_PRICING_CATALOG['gemini-nano-banana-2.1'].defaultImageSize).toBe('2K');
    });

    it('prefers persisted cost_usd on historical ledger rows and falls back safely', () => {
        expect(computeHistoricalGenerationCost({ cost_usd: 0.0712, model_id: 'gemini-3.1-flash-image' })).toBe(0.0712);
        const legacyFallback = computeHistoricalGenerationCost({
            model_id: 'gemini-3.1-flash-image',
            input_tokens: 1_000_000,
            output_tokens: 1_000_000,
        });
        expect(legacyFallback).toBeCloseTo(0.15 + 0.6 + 0.03, 4);
    });
});

describe('Phase 1 & 2 — Modular Prompts & Bug Fixes', () => {
    it('eliminates hardcoded square-post bias while keeping exact seamless weld invariants', () => {
        const { promptText } = buildRailingSynthesisPrompts({
            styleDescription: 'Round Pipe Satin Steel',
            specs: {
                hasBottomRail: false,
                postMount: 'side',
                hasReducers: false,
            },
        });

        expect(promptText.toLowerCase()).not.toContain('square post');
        expect(promptText).toContain('Every structural post');
        expect(promptText).toContain('POST-TO-RAIL JOINT (DIRECT SEAMLESS WELD)');
        expect(promptText).toContain('SIDE / FASCIA MOUNT - DIRECT 2-BOLT ATTACHMENT, NO PLATES');
        expect(promptText).toContain('Direct solid metal-to-metal fusion throughout');
    });

    it('substitutes both {{style}} and {{image}} placeholders cleanly and guards minimal DB stubs', () => {
        const fullTemplateRes = buildRailingSynthesisPrompts({
            styleDescription: 'Cable Fascia System',
            specs: { hasBottomRail: true },
            customMasterTemplate:
                'ARCHITECTURAL OVERRIDE: Retrofit {{image}} with style {{style}} while preserving all background lighting, masonry steps, walls, trim, and furniture across the staircase frame with exact 100% geometric accuracy and shadow grounding.',
        });
        expect(fullTemplateRes.promptText).toContain('IMAGE A (the attached Target Staircase photo)');
        expect(fullTemplateRes.promptText).toContain('Cable Fascia System');
        expect(fullTemplateRes.promptText).not.toContain('{{image}}');
        expect(fullTemplateRes.promptText).not.toContain('{{style}}');

        const stubRes = buildRailingSynthesisPrompts({
            styleDescription: 'Wrought Iron',
            specs: {},
            customMasterTemplate: 'Keep black metal crisp.',
        });
        expect(stubRes.promptText).toContain('PHASE 1: DEMOLITION');
        expect(stubRes.promptText).toContain('PHASE 2: DESIGN REPLICATION');
        expect(stubRes.promptText).toContain('Keep black metal crisp.');
    });

    it('adapts slot validation coach prompts dynamically for wall handrails', () => {
        const slot3 = STYLE_PHOTO_SLOTS.find((s) => s.id === 'post_mount_base')!;
        const stairPrompt = buildPhotoValidatorPrompt(slot3, 'stair_railing');
        const wallPrompt = buildPhotoValidatorPrompt(slot3, 'wall_handrail');

        expect(stairPrompt).toContain('Post Base / Stair Mount Close-Up');
        expect(wallPrompt).toContain('Wall Bracket Rosette / Anchor Close-Up');
        expect(buildFabSpecExtractorPrompt([{ slotId: 'hero_run', index: 0 }], 'stair_railing')).toContain(
            'Hero Full-Run Shot'
        );
        expect(buildVisionQaPrompt({ hasBottomRail: false, postMount: 'side', hasReducers: false })).toContain(
            'NO bottom rail'
        );
    });

    it('prevents hybrid bottom-rail + tread-mount pickets across un-upgraded legacy styles, fabricationSpec fallbacks, legacy placeholders, and Vision QA', () => {
        const legacyUnsetRes = buildRailingSynthesisPrompts({
            styleDescription: 'Hearts Wrought Iron',
            specs: { hasBottomRail: undefined, hasReducers: null },
        });
        expect(legacyUnsetRes.systemInstruction).toContain('MUTUALLY EXCLUSIVE BOTTOM TERMINATION');
        expect(legacyUnsetRes.promptText).toContain('BOTTOM TERMINATION FORENSIC LOCK');
        expect(legacyUnsetRes.promptText).toContain('NEVER render both a bottom shoe rail and direct-mount pickets at the same time');

        const specFallbackRes = buildRailingSynthesisPrompts({
            styleDescription: 'Hearts Wrought Iron',
            specs: {
                hasBottomRail: undefined,
                fabricationSpec: {
                    category: 'stair_railing',
                    material: 'wrought iron',
                    finish: 'black',
                    top_rail_profile: 'molded cap',
                    post_profile: '1.25 square',
                    post_mount_type: 'top',
                    bolt_pattern: '4-bolt base plate',
                    post_to_rail_joint: 'direct_flush_weld',
                    infill_type: 'custom_scroll',
                    infill_profile_and_spacing: '1/2 square pickets with hearts',
                    has_bottom_rail: true,
                    bottom_termination: 'continuous bottom shoe rail',
                    handrail_return: 'scroll volute',
                    distinctive_features: [],
                    conflicts_detected: [],
                    confidence_notes: '',
                },
            },
        });
        expect(specFallbackRes.promptText).toContain('BOTTOM SHOE RAIL REQUIRED (SOLID BARRIER — NO PICKET PASS-THROUGH)');

        const legacyPlaceholderRes = buildRailingSynthesisPrompts({
            styleDescription: 'Hearts Wrought Iron',
            specs: { hasBottomRail: true, postMount: 'top', hasReducers: false },
            customMasterTemplate:
                'ARCHITECTURAL PROMPT TEMPLATE FOR CUSTOM RAILINGS WITH LONG ENOUGH CONTEXT LENGTH TO AVOID STUB DETECTION AND TEST PLACEHOLDERS CLEANLY.\n{{mounting_logic}}\n{{reducers_logic}}\nFinalize lighting cleanly.',
        });
        expect(legacyPlaceholderRes.promptText).not.toContain('{{mounting_logic}}');
        expect(legacyPlaceholderRes.promptText).not.toContain('{{reducers_logic}}');
        expect(legacyPlaceholderRes.promptText).toContain('BOTTOM SHOE RAIL REQUIRED');
        expect(legacyPlaceholderRes.promptText).toContain('POST-TO-RAIL JOINT (DIRECT SEAMLESS WELD)');

        const qaPrompt = buildVisionQaPrompt({ hasBottomRail: true });
        expect(qaPrompt).toContain('CRITICAL AUTOMATIC FAIL RULE (HYBRID BOTTOM RAIL + PICKET PASS-THROUGH)');
        expect(qaPrompt).toContain('include "shoe_rail" in "suggested_targets"');
    });
});

describe('Phase 1 & 2 — Vertex Nano Banana 2.1 Transport & Multi-Turn Thought Signatures', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('sends 2K imageConfig, thinkingLevel MEDIUM, interleaved slot labels, and replays thoughtSignature into Pass 2', async () => {
        vi.doMock('@google-cloud/vertexai', () => ({
            VertexAI: class MockVertexAI {
                getGenerativeModel() {
                    return {};
                }
            },
        }));
        vi.doMock('google-auth-library', () => ({
            GoogleAuth: class MockGoogleAuth {
                async getClient() {
                    return {
                        async getAccessToken() {
                            return { token: 'mock-oauth-token' };
                        },
                    };
                }
                async getProjectId() {
                    return 'test-project';
                }
            },
        }));

        const fetchSpy = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 1850, thoughtsTokenCount: 170 },
                    candidates: [
                        {
                            content: {
                                role: 'model',
                                parts: [
                                    { thought: true, text: 'Aligning 2-bolt fascia posts' },
                                    {
                                        inlineData: { mimeType: 'image/jpeg', data: TINY_VALID_JPEG.toString('base64') },
                                        thoughtSignature: 'sig-turn-1-xyz',
                                    },
                                ],
                            },
                        },
                    ],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    usageMetadata: { promptTokenCount: 1600, candidatesTokenCount: 1720 },
                    candidates: [
                        {
                            content: {
                                role: 'model',
                                parts: [{ inlineData: { mimeType: 'image/jpeg', data: TINY_VALID_JPEG.toString('base64') } }],
                            },
                        },
                    ],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    usageMetadata: { promptTokenCount: 400, candidatesTokenCount: 90 },
                    candidates: [
                        {
                            content: {
                                role: 'model',
                                parts: [
                                    {
                                        text: JSON.stringify({
                                            demolition_required: true,
                                            existing_railing_present: true,
                                            existing_railing_description: 'wood spindle banister',
                                            stair_geometry: 'straight_flight',
                                            mounting_surface: 'wood_treads',
                                            recommended_mount_note: 'surface mount',
                                            lighting_direction: 'warm left window',
                                            occlusions_to_preserve: [],
                                        }),
                                    },
                                ],
                            },
                        },
                    ],
                }),
            });

        global.fetch = fetchSpy as any;

        const {
            generateDesignWithNanoBanana,
            refineDesignWithNanoBanana,
            analyzeSceneWithRouter,
            getConfiguredImageModelId,
            getConfiguredVisionModelId,
            getConfiguredThinkingLevel,
        } = await import('@/lib/vertex');

        expect(getConfiguredImageModelId()).toBe('gemini-nano-banana-2.1');
        expect(getConfiguredVisionModelId()).toBe('gemini-3.8-flash');
        expect(getConfiguredThinkingLevel()).toBe('MEDIUM');

        const prevThinking = process.env.VERTEX_THINKING_LEVEL;
        try {
            process.env.VERTEX_THINKING_LEVEL = 'high';
            expect(getConfiguredThinkingLevel()).toBe('HIGH');
            process.env.VERTEX_THINKING_LEVEL = 'invalid_level';
            expect(getConfiguredThinkingLevel()).toBe('MEDIUM');
        } finally {
            if (prevThinking === undefined) delete process.env.VERTEX_THINKING_LEVEL;
            else process.env.VERTEX_THINKING_LEVEL = prevThinking;
        }

        const b64 = TINY_VALID_JPEG.toString('base64');
        const pass1 = await generateDesignWithNanoBanana(b64, {
            base64StyleImages: [b64, b64],
            labeledSlotImages: [
                { slotId: 'hero_run', base64Data: b64 },
                { slotId: 'post_top_joint', base64Data: b64 },
                { slotId: 'post_mount_base', base64Data: b64 },
            ],
            technicalSpecs: { postMount: 'side', hasReducers: false, hasBottomRail: false },
        });

        expect(pass1.success).toBe(true);
        expect(pass1.modelUsed).toBe('gemini-nano-banana-2.1');
        expect(pass1.assistantTurnContent?.parts?.[1]?.thoughtSignature).toBe('sig-turn-1-xyz');

        const [url1, req1] = fetchSpy.mock.calls[0];
        expect(url1).toContain('/models/gemini-nano-banana-2.1:generateContent');
        const body1 = JSON.parse(req1.body);
        expect(body1.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'MEDIUM' });
        expect(body1.generationConfig.temperature).toBeUndefined();
        expect(body1.generationConfig.imageConfig.imageSize).toBe('2K');

        const textParts = body1.contents[0].parts.filter((p: any) => p.text).map((p: any) => p.text).join('\n');
        expect(textParts).toContain('SLOT 1');
        expect(textParts).toContain('SLOT 2');
        expect(textParts).toContain('SLOT 3');

        // Pass 2 stateful multi-turn refinement
        const pass2 = await refineDesignWithNanoBanana(
            pass1.image!,
            'Tighten bottom newel weld',
            [b64],
            undefined,
            b64,
            {
                initialUserParts: pass1.initialUserParts,
                assistantTurnContent: pass1.assistantTurnContent,
                qaInstructions: 'Fix bottom newel plate',
            }
        );

        expect(pass2.success).toBe(true);
        const [, req2] = fetchSpy.mock.calls[1];
        const body2 = JSON.parse(req2.body);
        expect(body2.contents).toHaveLength(3);
        expect(body2.contents[1].parts[1].thoughtSignature).toBe('sig-turn-1-xyz');

        // Vision call (Gemini 3.8 Flash) must omit deprecated `temperature` and configure `thinkingLevel`
        const routerRes = await analyzeSceneWithRouter(b64);
        expect(routerRes.analysis.demolition_required).toBe(true);
        const [url3, req3] = fetchSpy.mock.calls[2];
        expect(url3).toContain('/models/gemini-3.8-flash:generateContent');
        const body3 = JSON.parse(req3.body);
        expect(body3.generationConfig.temperature).toBeUndefined();
        expect(body3.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
    });
});

describe('Phase 2 & 3 — Pixel-Lock Compositor & Server Watermarking', () => {
    it('preserves untouched background pixels while keeping changed central railing region & server watermarks cleanly', async () => {
        const width = 128;
        const height = 128;

        // Solid warm wall original (#dcd2c8 = RGB 220,210,200)
        const origBuf = await sharp({
            create: { width, height, channels: 3, background: { r: 220, g: 210, b: 200 } },
        })
            .jpeg({ quality: 95 })
            .toBuffer();

        // Altered image: drifted noisy top-left corner (#dcd5c8 within delta<18) + bold black railing bar across center
        const rawGen = Buffer.alloc(width * height * 3);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 3;
                const isCenterBar = x >= 48 && x <= 80 && y >= 48 && y <= 80;
                rawGen[idx] = isCenterBar ? 15 : 224;
                rawGen[idx + 1] = isCenterBar ? 15 : 214;
                rawGen[idx + 2] = isCenterBar ? 15 : 204;
            }
        }
        const genBuf = await sharp(rawGen, { raw: { width, height, channels: 3 } })
            .jpeg({ quality: 95 })
            .toBuffer();

        const origUri = `data:image/jpeg;base64,${origBuf.toString('base64')}`;
        const genUri = `data:image/jpeg;base64,${genBuf.toString('base64')}`;

        const compositedUri = await pixelLockCompositeBackground({
            originalBase64: origUri,
            generatedBase64: genUri,
        });

        const compositedBuf = Buffer.from(compositedUri.split(',')[1], 'base64');
        const { data: pixels } = await sharp(compositedBuf).raw().toBuffer({ resolveWithObject: true });

        // Top-left unchanged corner should snap to original (~220, 210, 200)
        expect(Math.abs(pixels[0] - 220)).toBeLessThan(6);
        // Center railing pixel should remain dark (~15, 15, 15)
        const centerIdx = (64 * width + 64) * 3;
        expect(pixels[centerIdx]).toBeLessThan(35);

        // Server watermark check using local public/logo.png (no fetch calls!)
        const wm = await applyServerWatermark({ imageBase64: compositedUri });
        expect(wm.watermarkedOnServer).toBe(true);
        expect(wm.imageBase64.startsWith('data:image/jpeg;base64,')).toBe(true);
    });

    it('safely bypasses sharp on tiny <64px synthetic test buffers', async () => {
        const tinyUri = `data:image/jpeg;base64,${TINY_VALID_JPEG.toString('base64')}`;
        const composited = await pixelLockCompositeBackground({
            originalBase64: tinyUri,
            generatedBase64: tinyUri,
        });
        expect(composited).toBe(tinyUri);
        const wm = await applyServerWatermark({ imageBase64: tinyUri });
        expect(wm.watermarkedOnServer).toBe(false);
        expect(wm.imageBase64).toBe(tinyUri);
    });
});

describe('Phase 2 — Guided Wizard Slot Rules, Benchmark Allowlist & Backfill Safety', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('enforces Min 5 required slots and Max 8 total photos in wizard_mode=v2 and derives Pass 2 close-ups', async () => {
        const mockInsertSelectSingle = vi.fn(async () => ({ data: { id: 'style-v2-id' }, error: null }));
        const mockSupabase = {
            from: vi.fn((table: string) => {
                if (table === 'portfolio') {
                    return {
                        select: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                order: vi.fn(() => ({
                                    limit: vi.fn(() => ({
                                        single: vi.fn(async () => ({ data: { display_order: 2 }, error: null })),
                                    })),
                                })),
                            })),
                        })),
                        insert: vi.fn(() => ({
                            select: vi.fn(() => ({ single: mockInsertSelectSingle })),
                        })),
                    };
                }
                return { select: vi.fn() };
            }),
        };

        vi.doMock('@/lib/auth-utils', () => ({ checkIsAdmin: vi.fn(async () => false) }));
        vi.doMock('@/lib/auth-context', () => ({
            getActingUser: vi.fn(async () => ({
                user: { id: 'tenant-uuid-1' },
                tenantId: 'tenant-uuid-1',
                supabase: mockSupabase,
                isAdmin: false,
                isImpersonating: false,
            })),
        }));

        const { createStyle } = await import('@/app/actions/portfolio');

        // Missing slot 5 (end_return) -> MUST reject when wizard_mode='v2'
        const incompleteFd = new FormData();
        incompleteFd.set('wizard_mode', 'v2');
        incompleteFd.set('name', 'Test Railing');
        incompleteFd.set('description', 'Black steel');
        incompleteFd.set('image_url', 'https://cdn.example.com/1.jpg');
        incompleteFd.set(
            'labeled_slots',
            JSON.stringify({
                hero_run: ['https://cdn.example.com/1.jpg'],
                post_top_joint: ['https://cdn.example.com/2.jpg'],
                post_mount_base: ['https://cdn.example.com/3.jpg'],
                infill_bottom: ['https://cdn.example.com/4.jpg'],
            })
        );

        const incompleteRes = await createStyle(incompleteFd);
        expect(incompleteRes.error).toContain('End / Corner / Wall Return Close-Up');

        // Complete 5 required slots -> MUST succeed
        expect(MIN_WIZARD_REQUIRED_SLOTS).toBe(5);
        expect(MAX_WIZARD_TOTAL_PHOTOS).toBe(8);
        expect(MAX_FREE_CALIBRATION_RENDERS).toBe(3);

        const validFd = new FormData();
        validFd.set('wizard_mode', 'v2');
        validFd.set('name', 'Complete Guided Railing');
        validFd.set('description', '2-Bolt Fascia');
        validFd.set('image_url', 'https://cdn.example.com/1.jpg');
        validFd.set(
            'labeled_slots',
            JSON.stringify({
                hero_run: ['https://cdn.example.com/1.jpg'],
                post_top_joint: ['https://cdn.example.com/2.jpg'],
                post_mount_base: ['https://cdn.example.com/3.jpg'],
                infill_bottom: ['https://cdn.example.com/4.jpg'],
                end_return: ['https://cdn.example.com/5.jpg'],
            })
        );

        const okRes = await createStyle(validFd);
        expect((okRes as any).success).toBe(true);
    });

    it('enforces strict server-side benchmark allowlist and 3-free-render calibration limit', async () => {
        const styleId = '550e8400-e29b-41d4-a716-446655440099';
        const tenantId = '550e8400-e29b-41d4-a716-446655440011';

        vi.doMock('@/lib/auth-context', () => ({
            getActingUser: vi.fn(async () => ({
                user: { id: tenantId },
                tenantId,
                supabase: {
                    from: vi.fn(() => ({
                        select: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                eq: vi.fn(() => ({
                                    single: vi.fn(async () => ({
                                        data: {
                                            id: styleId,
                                            tenant_id: tenantId,
                                            name: 'Test Style',
                                            image_url: '/styles/modern.png',
                                            style_metadata: { free_calibration_used: 3 },
                                        },
                                        error: null,
                                    })),
                                })),
                            })),
                        })),
                    })),
                },
                isAdmin: false,
                isImpersonating: false,
            })),
        }));
        vi.doMock('@/lib/auth-utils', () => ({ checkIsAdmin: vi.fn(async () => false) }));

        const { runStyleCalibrationTest } = await import('@/app/actions/style-wizard');

        // 1. Path traversal / arbitrary preset rejection
        const badFd = new FormData();
        badFd.set('preset_id', '../logo.png');
        const badRes = await runStyleCalibrationTest(badFd);
        expect(badRes.success).toBe(false);
        expect(badRes.error).toContain('Invalid benchmark');

        // 2. 4th calibration render requires explicit credit consent
        const limitFd = new FormData();
        limitFd.set('preset_id', 'interior_hardwood');
        limitFd.set('style_id', styleId);
        const limitRes = await runStyleCalibrationTest(limitFd);
        expect(limitRes.success).toBe(false);
        expect((limitRes as any).requiresCreditConsent).toBe(true);
    });
});
