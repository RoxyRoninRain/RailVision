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
        expect(sysText).toContain('POST-TO-RAIL JUNCTION (DIRECT FLUSH COPED WELD - NO REDUCERS)');
        expect(sysText).toContain('Pay extra close attention to the post-to-rail connection point in both IMAGE B and IMAGE C');
        expect(sysText).toContain('The square posts must connect directly into the round top rail with a continuous flush coped weld joint (zero gap)');

        // 2. Verify priority directive is at the start of parts
        const parts = capturedRequestBody.contents[0].parts;
        const priorityPart = parts[0];
        expect(priorityPart.text).toContain('[CRITICAL POST-TO-RAIL DIRECTIVE: DIRECT FLUSH COPED WELD]');
        expect(priorityPart.text).toContain('Pay extra close attention to the post-to-rail connection point in both IMAGE B and IMAGE C');

        // 3. Verify user prompt text contains directive, connection focus, and final check
        const promptPart = parts.find((p: any) => typeof p.text === 'string' && p.text.includes('CRITICAL POST-TO-RAIL DIRECTIVE: DIRECT COPED WELD'));
        expect(promptPart).toBeDefined();
        expect(promptPart.text).toContain('Pay extra close attention to the post-to-rail connection point in both IMAGE B and IMAGE C');
        expect(promptPart.text).toContain('**FINAL VERIFICATION:** Confirm you examined the connection point in both IMAGE B and IMAGE C');
        // Verify negative keyword dumping was eliminated
        expect(promptPart.text).not.toContain('NEGATIVE CONSTRAINTS (STRICTLY PROHIBITED): reducers, bell reducers');
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
        expect(sysText).toContain('POST-TO-RAIL JUNCTION (DIRECT FLUSH COPED WELD - NO REDUCERS)');
        expect(sysText).toContain('Pay extra close attention to the post-to-rail connection point in both IMAGE B and IMAGE C');

        const parts = capturedRequestBody.contents[0].parts;
        const promptPart = parts.find((p: any) => typeof p.text === 'string' && p.text.includes('CRITICAL POST-TO-RAIL DIRECTIVE: DIRECT COPED WELD'));
        expect(promptPart).toBeDefined();
        expect(promptPart.text).toContain('Pay extra close attention to the post-to-rail connection point in both IMAGE B and IMAGE C');
        expect(promptPart.text).not.toContain('NEGATIVE CONSTRAINTS (STRICTLY PROHIBITED): reducers, bell reducers');
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
        expect(sysText).toContain('POST-TO-RAIL JUNCTION (REDUCER FITTINGS REQUIRED)');
        expect(sysText).toContain('Pay extra close attention to the post-to-rail connection point in both IMAGE B and IMAGE C');
        expect(sysText).toContain('Square posts must connect to the round top rail using square-to-round reducer fittings');

        const parts = capturedRequestBody.contents[0].parts;
        const priorityPart = parts[0];
        expect(priorityPart.text).toContain('[CRITICAL POST-TO-RAIL DIRECTIVE: REDUCER FITTINGS REQUIRED]');

        const promptPart = parts.find((p: any) => typeof p.text === 'string' && p.text.includes('REDUCER FITTINGS REQUIRED'));
        expect(promptPart).toBeDefined();
        expect(promptPart.text).toContain('Pay extra close attention to the post-to-rail connection point in both IMAGE B and IMAGE C');
        expect(promptPart.text).not.toContain('NEGATIVE CONSTRAINTS (STRICTLY PROHIBITED): reducers');
    });
});
