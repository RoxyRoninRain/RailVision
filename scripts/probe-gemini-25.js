const { VertexAI } = require('@google-cloud/vertexai');

// Initialize Vertex with your Cloud project and location
const projectId = process.env.VERTEX_PROJECT_ID || 'railvision-480923'; // Hardcoded from error message for safety
const location = 'global';

console.log(`[Probe] Testing models in project: ${projectId}, location: ${location}`);

const vertexAI = new VertexAI({
    project: projectId,
    location: location,
    apiEndpoint: 'aiplatform.googleapis.com',
});

const modelIds = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash-lite-001',
    'gemini-2.5-flash-lite-preview-09-2025',
    'gemini-2.5-flash-lite-preview',
];

async function probe() {
    for (const modelId of modelIds) {
        console.log(`\nTesting: ${modelId}...`);
        try {
            const model = vertexAI.getGenerativeModel({ model: modelId });
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
            });
            console.log(`✅ SUCCESS: ${modelId} is available!`);
            console.log('Response:', result.response.candidates[0].content.parts[0].text);
            return; // Exit on first success
        } catch (e) {
            console.log(`❌ FAILED: ${modelId}`);
            console.log(`   Error: ${e.message}`);
        }
    }
    console.log('\n[Probe] All attempts failed.');
}

probe();
