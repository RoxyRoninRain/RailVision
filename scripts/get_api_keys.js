const https = require('https');
const options = {
    hostname: 'api.supabase.com',
    path: '/v1/projects/zlwcdhgdmshtmkqngfzg/api-keys',
    method: 'GET',
    headers: {
        'Authorization': 'Bearer sbp_4ae6cd0d16331969504a9ecd1dea6c69555b298a',
        'User-Agent': 'node.js'
    }
};
const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const keys = JSON.parse(data);
            if (Array.isArray(keys)) {
                keys.forEach(k => console.log(`Name: ${k.name}, Key: ${k.api_key}`));
            } else {
                console.log("Not an array:", keys);
            }
        } catch (e) {
            console.log("Error parsing JSON:", e.message);
            console.log("Data:", data);
        }
    });
});
req.on('error', (e) => { console.error(e); });
req.end();
