const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getPrompt() {
    const { data, error } = await supabase
        .from('system_prompts')
        .select('system_instruction, user_template')
        .eq('key', 'gemini-handrail-main')
        .single();

    if (error) {
        console.error('Error fetching prompt:', error);
        return;
    }

    console.log('--- SYSTEM INSTRUCTION ---');
    console.log(data.system_instruction);
    console.log('\n--- USER TEMPLATE ---');
    console.log(data.user_template);
}

getPrompt();
