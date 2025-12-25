
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://zlwcdhgdmshtmkqngfzg.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsd2NkaGdkbXNodG1rcW5nZnpnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ5MTczOCwiZXhwIjoyMDgxMDY3NzM4fQ.oLrLRXM1pMqqGT5pqytSqiTm0MYMHz0IJUyPIHhN6Pw";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkProfiles() {
    console.log("Checking PROFILES table...");
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, shop_name');

    if (error) {
        console.error("Error fetching profiles:", error);
    } else {
        console.log("Profiles Found:");
        data.forEach(p => console.log(p));
    }
}

checkProfiles();
