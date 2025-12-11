import { VertexAI } from '@google-cloud/vertexai';

// Initialize Vertex with your Cloud project and location
const projectId = process.env.VERTEX_PROJECT_ID;
const location = process.env.VERTEX_LOCATION || 'us-central1';

if (!projectId && process.env.NODE_ENV !== 'development') {
    console.warn("VERTEX_PROJECT_ID is not set.");
}

const vertexAI = new VertexAI({ project: projectId || 'mock-project', location });

// Specialized model instantiation can go here
export const getGeminiModel = () => {
    return vertexAI.getGenerativeModel({ model: 'gemini-1.5-pro-preview-0409' }); // Or gemini-1.5-flash
};

export { vertexAI };
