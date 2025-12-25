const { createClient } = require('@supabase/supabase-js');

// extracted from .env.local output (from previous user turn)
const supabaseUrl = "https://zlwcdhgdmshtmkqngfzg.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsd2NkaGdkbXNodG1rcW5nZnpnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ5MTczOCwiZXhwIjoyMDgxMDY3NzM4fQ.oLrLRXM1pMqqGT5pqytSqiTm0MYMHz0IJUyPIHhN6Pw";

const supabase = createClient(supabaseUrl, serviceRoleKey);

const TENANT_ID = "cbc0da2d-7db3-4d42-93e8-404d38912364"; // From screenshot

async function checkSpecificTenant() {
    console.log(`Checking 'tenant-assets' for ID: ${TENANT_ID}`);

    const ADMIN_ID = "d899bbe8-10b5-4ee7-8ee5-5569e415178f";
    console.log(`\nListing ADMIN folder: '${ADMIN_ID}'`);
    const { data: rootData, error: rootError } = await supabase.storage
        .from('tenant-assets')
        .list(ADMIN_ID);

    if (rootError) {
        console.error("Error listed root:", rootError);
    } else {
        console.log("Root Items Found:", rootData.length);
        rootData.forEach(item => {
            console.log(` - [${item.id ? 'FILE' : 'FOLDER'}] ${item.name} (ID: ${item.id}, Meta: ${JSON.stringify(item.metadata)})`);
        });

        // 2. If 'General' or other folders found, list them
        for (const item of rootData) {
            if (!item.id) { // Assuming folder
                const folderPath = `${ADMIN_ID}/${item.name}`;
                console.log(`\nListing Subfolder: '${folderPath}'`);
                const { data: subData, error: subError } = await supabase.storage
                    .from('tenant-assets')
                    .list(folderPath);

                if (subError) console.error("Error listing subfolder:", subError);
                else {
                    subData.forEach(f => console.log(`   - ${f.name} (Size: ${f.metadata?.size})`));
                }
            }
        }
    }
}

checkSpecificTenant();
