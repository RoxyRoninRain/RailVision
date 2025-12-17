const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env.local');
const content = fs.readFileSync(envPath, 'utf8');

const lines = content.split('\n');
lines.forEach(line => {
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
        console.log('Found SUPABASE_SERVICE_ROLE_KEY line.');
        const rawValue = line.substring('SUPABASE_SERVICE_ROLE_KEY='.length).trim();
        console.log(`Length: ${rawValue.length}`);
        console.log(`Starts with: ${rawValue.substring(0, 5)}...`);
    }
    if (line.startsWith('GOOGLE_APPLICATION_CREDENTIALS=')) {
        console.log('Found GOOGLE_APPLICATION_CREDENTIALS line.');
        const rawValue = line.substring('GOOGLE_APPLICATION_CREDENTIALS='.length).trim();
        console.log(`Length: ${rawValue.length}`);
        console.log(`Starts with: ${rawValue.substring(0, 20)}`);
        console.log(`Ends with: ${rawValue.substring(rawValue.length - 20)}`);

        // Check for HTML
        if (rawValue.includes('<') || rawValue.includes('>')) {
            console.log('WARNING: Contains HTML characters!');
        }

        // Try Decode
        try {
            const isBase64 = !rawValue.startsWith('{');
            if (isBase64) {
                console.log('Detected Base64. Decoding...');
                const decoded = Buffer.from(rawValue, 'base64').toString('utf8');
                console.log(`Decoded Starts with: ${decoded.substring(0, 20)}`);
                console.log(`Decoded Ends with: ${decoded.substring(decoded.length - 20)}`);
                JSON.parse(decoded);
                console.log('JSON Parse Success!');
            } else {
                console.log('Detected Plain JSON.');
                JSON.parse(rawValue);
                console.log('JSON Parse Success!');
            }
        } catch (e) {
            console.error('Parse Error:', e.message);
        }
    }
});
