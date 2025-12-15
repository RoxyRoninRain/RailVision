
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';


// Manual .env parser
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (!fs.existsSync(envPath)) {
            console.log("No .env.local found at", envPath);
            return;
        }
        const envConfig = fs.readFileSync(envPath, 'utf8');
        console.log("Parsing .env.local...");
        envConfig.split('\n').forEach(line => {
            // Flexible match: allows spaces around =
            const match = line.match(/^\s*([^=\s]+)\s*=\s*(.*)$/);
            if (match) {
                const key = match[1].trim();
                // Remove surrounding quotes if present
                const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
                process.env[key] = value;
                // Log key (partially masked)
                console.log(`Loaded: ${key}`);
            }
        });
    } catch (e) {
        console.error("Error loading .env.local", e);
    }
}

loadEnv();


async function main() {
    console.log("--- FETCHING PROMPTS DEBUG ---");

    // 1. Verify Env
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url) {
        console.error("URL MISSING");
        process.exit(1);
    }

    if (!key) {
        console.warn("SERVICE KEY MISSING. Falling back to ANON KEY.");
        key = anonKey;
    }

    if (!key) {
        console.error("NO KEYS FOUND.");
        process.exit(1);
    }

    // 2. Client
    const supabase = createClient(url, key);

    // 3. Fetch
    const { data, error } = await supabase
        .from('system_prompts')
        .select('*');

    if (error) {
        console.error("DB ERROR:", error);
    } else {
        console.log("SUCCESS. Found", data.length, "prompts.");
        data.forEach(p => {
            console.log(`\n[PROMPT: ${p.key}](Active: ${p.is_active})`);
            console.log("--- SYSTEM INSTRUCTION ---");
            console.log(p.system_instruction);
            console.log("--- USER TEMPLATE ---");
            console.log(p.user_template);
            console.log("-----------------------------------");
        });
    }
}

main();
