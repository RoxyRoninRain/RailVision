const fs = require('fs');
const path = require('path');

const packageJson = require('../package.json');
const nextVersion = packageJson.dependencies.next;

console.log('Checking Next.js version...');
console.log(`Found: ${nextVersion}`);

const minVersion = '16.0.8';

// Remove strictness chars
const cleanVer = nextVersion.replace(/[^0-9.]/g, '');

const v1 = cleanVer.split('.').map(Number);
const v2 = minVersion.split('.').map(Number);

function isSafe(current, min) {
    for (let i = 0; i < 3; i++) {
        if (current[i] > min[i]) return true;
        if (current[i] < min[i]) return false;
    }
    return true; // Equal
}

if (isSafe(v1, v2)) {
    console.log('✅ Security Check Passed: Next.js version is safe.');
    process.exit(0);
} else {
    console.error('❌ Security Check Failed: Next.js version is below 16.0.8');
    process.exit(1);
}
