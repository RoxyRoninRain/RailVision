import { VertexAI } from '@google-cloud/vertexai';

// Initialize Vertex with your Cloud project and location
const projectId = process.env.VERTEX_PROJECT_ID;
const location = process.env.VERTEX_LOCATION || 'us-central1';

if (!projectId && process.env.NODE_ENV !== 'development') {
    console.warn("VERTEX_PROJECT_ID is not set.");
}

// Parse credentials from Env Var (Vercel support)
let googleAuthOptions = {};
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
        const credsStr = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        // Check if Base64 (starts with non-brace) or JSON
        const isBase64 = !credsStr.trim().startsWith('{');
        console.log(`[DEBUG] Found GOOGLE_APPLICATION_CREDENTIALS. Is Base64? ${isBase64}`);
        const jsonStr = isBase64 ? Buffer.from(credsStr, 'base64').toString('utf-8') : credsStr;
        googleAuthOptions = { credentials: JSON.parse(jsonStr) };
        console.log('[DEBUG] Credentials parsed successfully');
    } catch (e) {
        console.error("[ERROR] Failed to parse GOOGLE_APPLICATION_CREDENTIALS", e);
    }
}

const vertexAI = new VertexAI({
    project: projectId || 'mock-project',
    location,
    googleAuthOptions
});

// Specialized model instantiation can go here
export const getGeminiModel = () => {
    // Fallback to 1.0 Pro which is most widely available
    return vertexAI.getGenerativeModel({ model: 'gemini-1.0-pro' });
};

export { vertexAI };
