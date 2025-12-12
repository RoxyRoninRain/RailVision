const { VertexAI } = require('@google-cloud/vertexai');
const fs = require('fs');
const path = require('path');

// 1. Load Env Vars manually since we are running via node
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) envVars[key.trim()] = value.trim();
});

const projectId = envVars.VERTEX_PROJECT_ID || 'railvision-480923';
const location = envVars.VERTEX_LOCATION || 'us-central1';

console.log(`Checking models for Project: ${projectId}, Location: ${location}`);

// 2. Auth Setup
let googleAuthOptions = {};
if (envVars.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
        const credsStr = envVars.GOOGLE_APPLICATION_CREDENTIALS;
        const isBase64 = !credsStr.trim().startsWith('{');
        const jsonStr = isBase64 ? Buffer.from(credsStr, 'base64').toString('utf-8') : credsStr;
        googleAuthOptions = { credentials: JSON.parse(jsonStr) };
        console.log('Credentials loaded successfully.');
    } catch (e) {
        console.error("Failed to parse credentials", e);
    }
}

// 3. Initialize Vertex
const vertexAI = new VertexAI({
    project: projectId,
    location: location,
    googleAuthOptions
});

// 4. Test Model Availability
async function checkModel(modelId) {
    console.log(`\nTesting access to model: ${modelId}...`);
    try {
        const model = vertexAI.getGenerativeModel({ model: modelId });
        // Try a minimal prompt to see if it exists (even if it errors on content)
        // Just instantiating doesn't check existence, usually need to GENERATE
        const result = await model.generateContent("Hello");
        console.log(`✅ SUCCESS: ${modelId} is available!`);
    } catch (error) {
        if (error.message.includes('404')) {
            console.log(`❌ 404 NOT FOUND: ${modelId}`);
        } else if (error.message.includes('429')) {
            console.log(`⚠️  429 RATE LIMIT: ${modelId} (Exists but busy)`);
        } else {
            console.log(`❓ ERROR on ${modelId}:`, error.message.split('\n')[0]);
        }
    }
}

// 5. List of suspects
const suspects = [
    'gemini-3-pro-image',      // User request
    'gemini-3-pro-preview',    // Likely correct
    'gemini-experimental',
    'gemini-2.0-flash-exp',
    'gemini-1.5-pro'
];

async function run() {
    for (const id of suspects) {
        await checkModel(id);
    }
}

run();
