const { VertexAI } = require('@google-cloud/vertexai');
const fs = require('fs');
const path = require('path');

// 1. Env Vars
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) envVars[key.trim()] = value.trim();
});

const projectId = envVars.VERTEX_PROJECT_ID || 'railvision-480923';
// CRITICAL CHANGE: Testing 'global' location as per documentation
const location = 'global';

console.log(`Testing Gemini 3 Pro Image Preview...`);
console.log(`Project: ${projectId}`);
console.log(`Location: ${location}`);
console.log(`Model: gemini-3-pro-image-preview`);

// 2. Auth
let googleAuthOptions = {};
if (envVars.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
        const credsStr = envVars.GOOGLE_APPLICATION_CREDENTIALS;
        const isBase64 = !credsStr.trim().startsWith('{');
        const jsonStr = isBase64 ? Buffer.from(credsStr, 'base64').toString('utf-8') : credsStr;
        googleAuthOptions = { credentials: JSON.parse(jsonStr) };
    } catch (e) { console.error("Auth error", e); }
}

// 3. Initialize
const vertexAI = new VertexAI({
    project: projectId,
    location: location,
    apiEndpoint: 'aiplatform.googleapis.com', // Match the app's logic
    googleAuthOptions
});

async function run() {
    try {
        const model = vertexAI.getGenerativeModel({ model: 'gemini-3-pro-image-preview' });

        // Simple generation test
        const req = {
            contents: [{ role: 'user', parts: [{ text: "Describe a red ball." }] }]
        };

        console.log('Sending request...');
        const result = await model.generateContent(req);
        console.log('Response received!');
        console.log(JSON.stringify(result.response, null, 2));
        console.log('✅ SUCCESS: Global endpoint works!');
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        if (error.response) console.error(JSON.stringify(error.response, null, 2));
    }
}

run();
