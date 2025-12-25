
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://zlwcdhgdmshtmkqngfzg.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsd2NkaGdkbXNodG1rcW5nZnpnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ5MTczOCwiZXhwIjoyMDgxMDY3NzM4fQ.oLrLRXM1pMqqGT5pqytSqiTm0MYMHz0IJUyPIHhN6Pw";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function listUsers() {
    console.log("Listing AUTH Users...");
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error("Error fetching users:", error);
    } else {
        console.log("Auth Users Found:");
        users.forEach(u => {
            console.log(`Email: ${u.email} | ID: ${u.id} | Last Sign In: ${u.last_sign_in_at}`);
        });
    }
}

listUsers();
