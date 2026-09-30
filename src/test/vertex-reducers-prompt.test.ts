import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@google-cloud/vertexai', () => ({
    VertexAI: vi.fn(function () {
        return {
            getGenerativeModel: vi.fn().mockReturnValue({}),
        };
    }),
}));

vi.mock('google-auth-library', () => ({
    GoogleAuth: vi.fn(function () {
        return {
            getClient: vi.fn().mockResolvedValue({
                getAccessToken: vi.fn().mockResolvedValue({ token: 'mock-access-token' }),
            }),
        };
    }),
}));

describe('Vertex NanoBanana Prompt & SystemInstruction Reducer Enforcement', () => {
    let capturedRequestBody: any = null;

    beforeEach(() => {
        vi.clearAllMocks();
        capturedRequestBody = null;

        global.fetch = vi.fn(async (url: any, options: any) => {
            if (options && options.body) {
                capturedRequestBody = JSON.parse(options.body);
            }
            return {
                ok: true,
                json: async () => ({
                    candidates: [
                        {
                            content: {
                                parts: [
                                    {
                                        inlineData: {
                                            mimeType: 'image/jpeg',
                                            data: 'base64generatedimage'
                                        }
                                    }
                                ]
                            }
                        }
                    ],
                    usageMetadata: {
                        promptTokenCount: 150,
                        candidatesTokenCount: 200
                    }
                }),
            } as any;
        });
    });

    it('sends systemInstruction in the REST fetch payload and strictly prohibits reducers by default', async () => {
        const { generateDesignWithNanoBanana } = await import('@/lib/vertex');

        const result = await generateDesignWithNanoBanana(
            'fakeBase64Target',
            {
                base64StyleImages: ['fakeBase64Style'],
                technicalSpecs: {
                    hasReducers: false,
                    hasBottomRail: false,
                    description: 'Square posts with round top rail'
                }
            }
        );

        expect(result.success).toBe(true);
        expect(capturedRequestBody).toBeDefined();

        // 1. Verify systemInstruction is present in request body
        expect(capturedRequestBody.systemInstruction).toBeDefined();
        const sysText = capturedRequestBody.systemInstruction.parts[0].text;
        expect(sysText).toContain('CRITICAL FABRICATION MANDATE (ZERO REDUCERS / DIRECT FLUSH WELD)');
        expect(sysText).toContain('Square posts MUST connect directly into the round top rail');
        expect(sysText).toContain('DO NOT add, render, or hallucinate reducers, bell reducers, conical fittings, pipe adapters, or transition collars');

        // 2. Verify priority directive is at the start of parts
        const parts = capturedRequestBody.contents[0].parts;
        const priorityPart = parts[0];
        expect(priorityPart.text).toContain('[CRITICAL FABRICATION DIRECTIVE: DIRECT FLUSH MOUNT - NO REDUCERS]');

        // 3. Verify user prompt text contains mandate, negative constraints, and final check
        const promptPart = parts.find((p: any) => typeof p.text === 'string' && p.text.includes('CRITICAL FABRICATION MANDATE: DIRECT FLUSH MOUNT'));
        expect(promptPart).toBeDefined();
        expect(promptPart.text).toContain('NEGATIVE CONSTRAINTS (STRICTLY PROHIBITED):');
        expect(promptPart.text).toContain('reducers, bell reducers, pipe reducers, post transition collars');
        expect(promptPart.text).toContain('**FINAL VERIFICATION:** Confirm there are NO reducers');
    });

    it('defaults to ZERO REDUCERS even when hasReducers is null or undefined', async () => {
        const { generateDesignWithNanoBanana } = await import('@/lib/vertex');

        const result = await generateDesignWithNanoBanana(
            'fakeBase64Target',
            {
                base64StyleImages: ['fakeBase64Style'],
                technicalSpecs: {
                    hasReducers: null,
                    hasBottomRail: false
                }
            }
        );

        expect(result.success).toBe(true);
        expect(capturedRequestBody).toBeDefined();

        const sysText = capturedRequestBody.systemInstruction.parts[0].text;
        expect(sysText).toContain('CRITICAL FABRICATION MANDATE (ZERO REDUCERS / DIRECT FLUSH WELD)');

        const parts = capturedRequestBody.contents[0].parts;
        const promptPart = parts.find((p: any) => typeof p.text === 'string' && p.text.includes('CRITICAL FABRICATION MANDATE: DIRECT FLUSH MOUNT'));
        expect(promptPart).toBeDefined();
        expect(promptPart.text).toContain('NEGATIVE CONSTRAINTS (STRICTLY PROHIBITED):');
        expect(promptPart.text).toContain('bell reducers');
    });

    it('instructs reducer fittings when hasReducers is explicitly true', async () => {
        const { generateDesignWithNanoBanana } = await import('@/lib/vertex');

        const result = await generateDesignWithNanoBanana(
            'fakeBase64Target',
            {
                base64StyleImages: ['fakeBase64Style'],
                technicalSpecs: {
                    hasReducers: true,
                    hasBottomRail: false
                }
            }
        );

        expect(result.success).toBe(true);
        expect(capturedRequestBody).toBeDefined();

        const sysText = capturedRequestBody.systemInstruction.parts[0].text;
        expect(sysText).toContain('Square posts must connect to the round top rail using reducer fittings');
        expect(sysText).not.toContain('CRITICAL FABRICATION MANDATE (ZERO REDUCERS');

        const parts = capturedRequestBody.contents[0].parts;
        // Priority directive should NOT forbid reducers
        const forbidPart = parts.find((p: any) => p.text?.includes('DIRECT FLUSH MOUNT - NO REDUCERS'));
        expect(forbidPart).toBeUndefined();

        const promptPart = parts.find((p: any) => typeof p.text === 'string' && p.text.includes('REDUCER FITTINGS REQUIRED'));
        expect(promptPart).toBeDefined();
        expect(promptPart.text).not.toContain('NEGATIVE CONSTRAINTS (STRICTLY PROHIBITED): reducers');
    });
});
