
import * as React from 'react';

export function LowBalanceEmail() {
    return (
        <div style={{ fontFamily: 'sans-serif', lineHeight: '1.5', color: '#333' }}>
            <h2 style={{ color: '#d97706' }}>⚠️ Balance Warning</h2>

            <p>
                This is a friendly reminder that you have <strong>10 or fewer renderings left</strong> in your monthly allowance.
            </p>

            <p style={{ backgroundColor: '#fff3cd', padding: '15px', borderRadius: '5px', border: '1px solid #ffeeba' }}>
                To ensure your Visualizer continues to work for you and your potential customers without interruption,
                please consider enabling <strong>Overdrive</strong>.
            </p>

            <p>
                <a
                    href="https://railify.app/dashboard/settings"
                    style={{
                        display: 'inline-block',
                        backgroundColor: '#007bff',
                        color: '#fff',
                        padding: '10px 20px',
                        textDecoration: 'none',
                        borderRadius: '5px',
                        fontWeight: 'bold'
                    }}
                >
                    Enable Overdrive Now
                </a>
            </p>

            <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

            <p style={{ fontSize: '0.9em', color: '#666' }}>
                Railify AI
            </p>
        </div>
    );
}

export default LowBalanceEmail;
