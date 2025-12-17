const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env.local');
try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    console.log('Found .env.local');

    envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key) {
            console.log(`Key: ${key.trim()}`);
        }
    });

} catch (e) {
    console.error('Could not read .env.local', e.message);
}
