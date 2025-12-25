
const { createClient } = require('@supabase/supabase-js');

// extracted from .env.local output
const supabaseUrl = "https://zlwcdhgdmshtmkqngfzg.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsd2NkaGdkbXNodG1rcW5nZnpnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ5MTczOCwiZXhwIjoyMDgxMDY3NzM4fQ.oLrLRXM1pMqqGT5pqytSqiTm0MYMHz0IJUyPIHhN6Pw";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkBuckets() {
    console.log("Checking Storage Buckets via Node...");

    const buckets = ['logos', 'admin-assets', 'tenant-assets', 'portfolio'];

    for (const bucket of buckets) {
        console.log(`\n--- Bucket: ${bucket} ---`);

        const { data: files, error } = await supabase.storage.from(bucket).list('', { limit: 100 });

        if (error) {
            console.log(`Error listing ${bucket}:`, error.message);
        } else {
            console.log(`File Count: ${files ? files.length : 0}`);
            if (files && files.length > 0) {
                console.log("Found files:");
                files.slice(0, 5).forEach(f => console.log(` - ${f.name} (${(f.metadata ? f.metadata.size : 0)} bytes)`));
            } else {
                console.log("Bucket appears empty at root.");
            }
        }
    }
}

checkBuckets();
