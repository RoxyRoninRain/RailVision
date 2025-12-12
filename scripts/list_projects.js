const https = require('https');
const options = {
    hostname: 'api.supabase.com',
    path: '/v1/projects',
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
            const projects = JSON.parse(data);
            if (Array.isArray(projects)) {
                projects.forEach(p => console.log(`ID: ${p.id}, Name: ${p.name}, Region: ${p.region}`));
            } else {
                console.log("Not an array:", projects);
            }
        } catch (e) {
            console.log("Error parsing JSON:", e.message);
            console.log("Data:", data);
        }
    });
});
req.on('error', (e) => { console.error(e); });
req.end();
