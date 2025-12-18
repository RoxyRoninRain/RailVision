const { VertexAI } = require('@google-cloud/vertexai');

const projectId = process.env.VERTEX_PROJECT_ID || 'railvision-480923';
const location = 'global'; // Trying global first

console.log(`[Probe] Testing Gemini 3 models in project: ${projectId}, location: ${location}`);

const vertexAI = new VertexAI({
    project: projectId,
    location: location,
    apiEndpoint: 'aiplatform.googleapis.com',
});

const modelIds = [
    'gemini-3.0-pro-image-preview',
    'gemini-3-pro-image-preview',
    'gemini-experimental',
    'gemini-3.0-pro-preview',
    'gemini-3.0-flash-preview',
];

async function probe() {
    for (const modelId of modelIds) {
        console.log(`\nTesting: ${modelId}...`);
        try {
            const model = vertexAI.getGenerativeModel({ model: modelId });
            // Simple text test first
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
            });
            console.log(`✅ SUCCESS: ${modelId} is available!`);
            return;
        } catch (e) {
            console.log(`❌ FAILED: ${modelId}`);
            console.log(`   Error: ${e.message}`);
        }
    }
    console.log('\n[Probe] All attempts failed.');
}

probe();
