const fs = require('fs');
try {
    const content = fs.readFileSync('.env.local', 'utf8');
    const lines = content.split(/\r?\n/);
    console.log('---PARSED LINES---');
    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        // keys we want to PRESERVE
        if (trimmed.startsWith('STRIPE') || trimmed.startsWith('NEXT_PUBLIC_STRIPE') || trimmed.startsWith('VERTEX') || trimmed.startsWith('NEXT_PUBLIC_APP') || trimmed.startsWith('ACCESS_TOKEN')) {
            console.log('PRESERVE:' + trimmed);
        }
        // keys we are REPLACING (just to see if they exist)
        else if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE') || trimmed.startsWith('SUPABASE')) {
            console.log('REPLACING:' + trimmed.split('=')[0] + '=(redacted)');
        }
        else {
            // Log unknown keys to decide
            console.log('UNKNOWN:' + trimmed.substring(0, 20) + '...');
        }
    });
    console.log('---END PARSE---');
} catch (e) {
    console.error(e);
}
