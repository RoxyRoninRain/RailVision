const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnv = (key) => {
    const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1].trim() : null;
};

const apiKey = getEnv('RESEND_API_KEY');

if (!apiKey) {
    console.error("No RESEND_API_KEY found in .env.local");
    process.exit(1);
}

const resend = new Resend(apiKey);

async function testEmail() {
    console.log("Attempting to send test email with Key:", apiKey.substring(0, 5) + "...");

    try {
        const { data, error } = await resend.emails.send({
            from: 'Railify Notifications <onboarding@resend.dev>',
            to: 'missmetalmagic@gmail.com', // Actual tenant email found in profile
            subject: 'Direct Test Email via Script',
            html: '<p>This is a direct test from the script using onboarding domain.</p>'
        });

        if (error) {
            console.error("Resend API Error:", error);
        } else {
            console.log("Success! ID:", data.id);
        }
    } catch (e) {
        console.error("Exception sending email:", e);
    }
}

testEmail();
