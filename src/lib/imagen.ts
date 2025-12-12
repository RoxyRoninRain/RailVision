// @ts-ignore
import { PredictionServiceClient } from '@google-cloud/aiplatform';
// @ts-ignore
import { helpers } from '@google-cloud/aiplatform';
import { ensureGoogleCredentials } from './auth-helper';

// Initialize credentials file for the SDK
ensureGoogleCredentials();

const projectId = process.env.VERTEX_PROJECT_ID;
const location = 'us-central1';
const endpoint = `us-central1-aiplatform.googleapis.com`;

const clientOptions = {
    apiEndpoint: endpoint,
};

const predictionServiceClient = new PredictionServiceClient(clientOptions);

export async function generateImage(prompt: string, base64InputImage?: string, base64Mask?: string): Promise<{ success: boolean, image?: string, error?: string }> {
    try {
        console.log('[IMAGEN] generating image (Image Guided Mode)...');

        const modelName = `projects/${projectId}/locations/${location}/publishers/google/models/imagegeneration@006`;

        const instanceObj: any = {
            prompt: prompt,
        };

        if (base64InputImage) {
            instanceObj.image = { bytesBase64Encoded: base64InputImage };
            if (base64Mask) {
                instanceObj.mask = { bytesBase64Encoded: base64Mask };
            }
        }

        const instances = [
            helpers.toValue(instanceObj)
        ];

        const parameters = helpers.toValue({
            sampleCount: 1,
            aspectRatio: "1:1",
            // "mode": "upscale" // Not compatible with standard generation
        });

        const predictionResult = await predictionServiceClient.predict({
            endpoint: modelName,
            instances: instances as any,
            parameters: parameters as any,
        }) as any;

        const response = predictionResult[0];

        if (!response.predictions || response.predictions.length === 0) {
            throw new Error('No predictions returned');
        }

        const prediction = response.predictions[0];
        // @ts-ignore
        const bytesBase64Encoded = prediction.structValue?.fields?.bytesBase64Encoded?.stringValue;

        if (bytesBase64Encoded) {
            return {
                success: true,
                image: `data:image/png;base64,${bytesBase64Encoded}`
            };
        }

        return { success: false, error: 'No image data in response' };

    } catch (error: any) {
        console.error('[IMAGEN ERROR]', error);
        // Fallback: If image guidance fails, try pure text generation? 
        // No, let's return the error so we can debug.
        return { success: false, error: error.message };
    }
}
