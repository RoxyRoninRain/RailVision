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

    it('delivers toggle-controlled post-to-rail directives without polluting systemInstruction when hasReducers is false', async () => {
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

        // 1. systemInstruction should remain clean and architectural (not polluted with post-to-rail specific rules)
        expect(capturedRequestBody.systemInstruction).toBeDefined();
        const sysText = capturedRequestBody.systemInstruction.parts[0].text;
        expect(sysText).not.toContain('POST-TO-RAIL JUNCTION');

        // 2. User prompt contains the toggle-controlled NO REDUCERS / DIRECT WELD logic
        const parts = capturedRequestBody.contents[0].parts;
        const promptPart = parts.find((p: any) => typeof p.text === 'string' && p.text.includes('POST-TO-RAIL GEOMETRY'));
        expect(promptPart).toBeDefined();
        expect(promptPart.text).toContain('The round top handrail is the structural top cap of the railing');
        expect(promptPart.text).toContain('Every post (starting newel post at the bottom of the stairs');
        expect(promptPart.text).toContain('NO handrail saddle brackets, NO standoff stems, NO pivot pins');
    });

    it('does not inject rigid reducer constraints when hasReducers is null or undefined', async () => {
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

        // Neither systemInstruction nor user prompt should force reducers or no-reducers
        const sysText = capturedRequestBody.systemInstruction.parts[0].text;
        expect(sysText).not.toContain('POST-TO-RAIL JUNCTION');

        const parts = capturedRequestBody.contents[0].parts;
        const promptPart = parts.find((p: any) => typeof p.text === 'string' && p.text.includes('POST-TO-RAIL JUNCTION'));
        expect(promptPart).toBeUndefined();
    });

    it('instructs reducer fittings via toggle when hasReducers is explicitly true', async () => {
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

        // systemInstruction remains clean
        const sysText = capturedRequestBody.systemInstruction.parts[0].text;
        expect(sysText).not.toContain('POST-TO-RAIL JUNCTION');

        // User prompt contains REDUCER FITTINGS REQUIRED
        const parts = capturedRequestBody.contents[0].parts;
        const promptPart = parts.find((p: any) => typeof p.text === 'string' && p.text.includes('REDUCER FITTINGS REQUIRED'));
        expect(promptPart).toBeDefined();
        expect(promptPart.text).toContain('The style requires reducer fittings');
        expect(promptPart.text).toContain('post-top stem reducers');
    });
});
