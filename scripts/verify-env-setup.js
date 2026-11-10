/**
 * Verify local environment variable setup (.env.local) without exposing secret values.
 * Run with: node scripts/verify-env-setup.js
 */
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local file not found in project root!');
    process.exitCode = 1;
} else {
    runChecks();
}

function decodeJwtSection(jwt, index) {
    try {
        const parts = jwt.split('.');
        if (parts.length !== 3) return null;
        return JSON.parse(Buffer.from(parts[index], 'base64url').toString('utf8'));
    } catch {
        return null;
    }
}

async function runChecks() {
    const rawEnv = fs.readFileSync(envPath, 'utf8');
    const env = {};
    for (const line of rawEnv.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        env[key] = val;
    }

    console.log('=== Railify Security & Environment Verification ===\n');
    let hasErrors = false;

    // 1. NEXT_PUBLIC_SUPABASE_URL
    const supaUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    if (supaUrl && supaUrl.startsWith('https://') && supaUrl.includes('.supabase.co')) {
        console.log(`✅ NEXT_PUBLIC_SUPABASE_URL: Valid (${supaUrl})`);
    } else {
        console.log('❌ NEXT_PUBLIC_SUPABASE_URL: Missing or invalid URL');
        hasErrors = true;
    }

    // 2. NEXT_PUBLIC_SUPABASE_ANON_KEY
    const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const anonPayload = anonKey ? decodeJwtSection(anonKey, 1) : null;
    if (anonPayload && anonPayload.role === 'anon') {
        console.log('✅ NEXT_PUBLIC_SUPABASE_ANON_KEY: Valid JWT format (role: anon)');
    } else {
        console.log('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY: Invalid or missing anon JWT');
        hasErrors = true;
    }

    // 3. SUPABASE_SERVICE_ROLE_KEY
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const servicePayload = serviceKey ? decodeJwtSection(serviceKey, 1) : null;
    if (!serviceKey || !servicePayload || servicePayload.role !== 'service_role') {
        console.log('❌ SUPABASE_SERVICE_ROLE_KEY: Missing or role is not service_role');
        hasErrors = true;
    } else if (anonKey && serviceKey.split('.')[2] === anonKey.split('.')[2]) {
        console.log('❌ SUPABASE_SERVICE_ROLE_KEY: INVALID SIGNATURE! It shares the same signature as your anon key. Copy the real service_role secret from Supabase Dashboard -> Project Settings -> API.');
        hasErrors = true;
    } else if (supaUrl) {
        try {
            const res = await fetch(`${supaUrl}/auth/v1/admin/users?per_page=1`, {
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`,
                },
            });
            if (res.ok) {
                console.log('✅ SUPABASE_SERVICE_ROLE_KEY: Verified live against Supabase Admin Auth API!');
            } else {
                const errText = await res.text();
                console.log(`❌ SUPABASE_SERVICE_ROLE_KEY: Rejected by Supabase (${res.status}: ${errText})`);
                hasErrors = true;
            }
        } catch (e) {
            console.log(`⚠️ SUPABASE_SERVICE_ROLE_KEY: Could not reach Supabase to verify online (${e.message})`);
        }
    }

    // 4. VERTEX_PROJECT_ID & GOOGLE_APPLICATION_CREDENTIALS
    const vertexProject = env.VERTEX_PROJECT_ID;
    const gcreds = env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!vertexProject) {
        console.log('❌ VERTEX_PROJECT_ID: Missing');
        hasErrors = true;
    } else {
        console.log(`✅ VERTEX_PROJECT_ID: Present (${vertexProject})`);
    }

    if (!gcreds || gcreds === 'service-account.json') {
        if (gcreds === 'service-account.json' && fs.existsSync(path.resolve(process.cwd(), 'service-account.json'))) {
            console.log('✅ GOOGLE_APPLICATION_CREDENTIALS: Points to existing local service-account.json file');
        } else {
            console.log('❌ GOOGLE_APPLICATION_CREDENTIALS: Currently set to placeholder "service-account.json" (file not found). Paste your Base64-encoded Google Service Account JSON here.');
            hasErrors = true;
        }
    } else if (fs.existsSync(gcreds)) {
        console.log(`✅ GOOGLE_APPLICATION_CREDENTIALS: Points to existing file (${gcreds})`);
    } else {
        try {
            const jsonStr = gcreds.trim().startsWith('{')
                ? gcreds.trim()
                : Buffer.from(gcreds.trim(), 'base64').toString('utf8');
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === 'service_account' && parsed.private_key && parsed.client_email) {
                console.log(`✅ GOOGLE_APPLICATION_CREDENTIALS: Valid Service Account JSON (${parsed.client_email})`);
            } else {
                console.log('❌ GOOGLE_APPLICATION_CREDENTIALS: JSON is missing service_account fields (private_key / client_email)');
                hasErrors = true;
            }
        } catch {
            console.log('❌ GOOGLE_APPLICATION_CREDENTIALS: Could not parse as Base64 or JSON');
            hasErrors = true;
        }
    }

    // 5. RESEND_API_KEY
    const resendKey = env.RESEND_API_KEY;
    if (resendKey && resendKey.startsWith('re_') && resendKey.length > 10) {
        console.log('✅ RESEND_API_KEY: Valid format (re_...)');
    } else {
        console.log('❌ RESEND_API_KEY: Missing or does not start with re_');
        hasErrors = true;
    }

    // 6. STRIPE KEYS
    const stripePub = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    const stripeSec = env.STRIPE_SECRET_KEY;
    const stripeWh = env.STRIPE_WEBHOOK_SECRET;

    if (stripePub && (stripePub.startsWith('pk_live_') || stripePub.startsWith('pk_test_'))) {
        console.log(`✅ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: Valid format (${stripePub.slice(0, 8)}...)`);
    } else {
        console.log('❌ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: Missing or invalid format');
        hasErrors = true;
    }

    if (stripeSec && (stripeSec.startsWith('sk_live_') || stripeSec.startsWith('sk_test_'))) {
        const modeNote = stripeSec.startsWith('sk_live_') ? '(LIVE key — consider using sk_test_ locally)' : '(TEST key)';
        console.log(`✅ STRIPE_SECRET_KEY: Valid format ${modeNote}`);
    } else {
        console.log('❌ STRIPE_SECRET_KEY: Missing or invalid format');
        hasErrors = true;
    }

    if (stripeWh && stripeWh.startsWith('whsec_')) {
        console.log('✅ STRIPE_WEBHOOK_SECRET: Valid format (whsec_...)');
    } else {
        console.log('❌ STRIPE_WEBHOOK_SECRET: Missing or invalid format');
        hasErrors = true;
    }

    console.log('\n---------------------------------------------------');
    if (hasErrors) {
        console.log('⚠️  Some environment variables still need attention (see ❌ items above).');
        process.exitCode = 1;
    } else {
        console.log('🎉 All environment variables in .env.local are valid and verified!');
    }
}
