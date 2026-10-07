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
        const promptPart = parts.find((p: any) => typeof p.text === 'string' && p.text.includes('POST-TO-RAIL JOINT (DIRECT SEAMLESS WELD)'));
        expect(promptPart).toBeDefined();
        expect(promptPart.text).toContain('Exactly match the seamless joint shown in **IMAGE B** and **IMAGE C**');
        expect(promptPart.text).toContain('single continuous tube that reaches all the way to touch the underside of the top handrail');
        expect(promptPart.text).toContain('Direct solid metal-to-metal fusion throughout');
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

    it('injects side-mount fascia directives when postMount is side', async () => {
        const { generateDesignWithNanoBanana } = await import('@/lib/vertex');

        const result = await generateDesignWithNanoBanana(
            'fakeBase64Target',
            {
                base64StyleImages: ['fakeBase64Style'],
                technicalSpecs: {
                    postMount: 'side',
                    hasBottomRail: false
                }
            }
        );

        expect(result.success).toBe(true);
        expect(capturedRequestBody).toBeDefined();

        const parts = capturedRequestBody.contents[0].parts;
        const promptPart = parts.find((p: any) => typeof p.text === 'string' && p.text.includes('SIDE / FASCIA MOUNT - DIRECT 2-BOLT ATTACHMENT, NO PLATES'));
        expect(promptPart).toBeDefined();
        expect(promptPart.text).toContain('Side Mount (Fascia Mount)');
        expect(promptPart.text).toContain('outer side face / exterior stringer / side fascia');
        expect(promptPart.text).toContain('2 through-bolts (vertically stacked)');
        expect(promptPart.text).toContain('STRICTLY NO MOUNTING PLATES OR BRACKETS');
    });

    it('injects top-mount surface directives when postMount is top', async () => {
        const { generateDesignWithNanoBanana } = await import('@/lib/vertex');

        const result = await generateDesignWithNanoBanana(
            'fakeBase64Target',
            {
                base64StyleImages: ['fakeBase64Style'],
                technicalSpecs: {
                    postMount: 'top',
                    hasBottomRail: false
                }
            }
        );

        expect(result.success).toBe(true);
        expect(capturedRequestBody).toBeDefined();

        const parts = capturedRequestBody.contents[0].parts;
        const promptPart = parts.find((p: any) => typeof p.text === 'string' && p.text.includes('TOP / SURFACE MOUNT REQUIRED'));
        expect(promptPart).toBeDefined();
        expect(promptPart.text).toContain('Top Mount (Surface Mount)');
        expect(promptPart.text).toContain('top horizontal surface of the stair treads or landing floor');
        expect(promptPart.text).toContain('surface-mounted base plates / flange shoes');
    });
});
