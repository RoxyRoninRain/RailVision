const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// remove whitespace from key in case of powershell wrapping
const cleanKey = supabaseKey.replace(/\s+/g, '');

const supabase = createClient(supabaseUrl, cleanKey);

async function run() {
  const { data, error } = await supabase.from('profiles').select('*').ilike('shop_name', '%AGS Stainless%');
  console.log('Result:', JSON.stringify(data, null, 2));
  if (error) console.error('Error:', error);
}
run();
