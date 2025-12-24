const fs = require('fs');
try {
    const content = fs.readFileSync('projects.json', 'utf16le');
    // Remove BOM if present
    const clean = content.replace(/^\uFEFF/, '');
    const data = JSON.parse(clean);
    console.log(data[0].id);
} catch (e) {
    console.error(e);
}
