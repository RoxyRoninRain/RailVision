import * as React from 'react';

interface WelcomeEmailProps {
    name?: string;
}

export function WelcomeEmail({
    name,
}: WelcomeEmailProps) {
    return (
        <div style={{ fontFamily: 'sans-serif', lineHeight: '1.5', color: '#333' }}>
            <h1>Welcome to Railify{name ? `, ${name}` : ''}!</h1>

            <p>
                <strong>Payment Received</strong><br />
                Thank you for your purchase. We are thrilled to have you on board!
            </p>

            <p>
                To get started, please log in to your dashboard here:<br />
                <a href="https://railify.app/login" style={{ color: '#007bff' }}>https://railify.app/login</a>
            </p>

            <h3>Important Next Steps:</h3>
            <ul>
                <li><strong>Upload Images:</strong> Visit your dashboard to upload your portfolio images.</li>
                <li><strong>Configure Shop Settings:</strong> Set up your shop profile and preferences.</li>
            </ul>

            <p style={{ backgroundColor: '#fff3cd', padding: '10px', borderRadius: '5px', border: '1px solid #ffeeba' }}>
                <strong>Note:</strong> Your subscription clock doesn't start until onboarding is complete.
            </p>

            <p>
                We will be in touch soon to ensure everything is running smoothly.
            </p>

            <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

            <p style={{ fontSize: '0.9em', color: '#666' }}>
                Need help? Contact us at <a href="mailto:railifyai@gmail.com">railifyai@gmail.com</a>
            </p>
        </div>
    );
}

export default WelcomeEmail;
