
import * as React from 'react';

export function UsageWarningEmail() {
    return (
        <div style={{ fontFamily: 'sans-serif', lineHeight: '1.5', color: '#333' }}>
            <h2 style={{ color: '#d97706' }}>⚠️ Spending Limit Warning</h2>

            <p>
                You are within <strong>$10.00</strong> of your monthly spending limit.
            </p>

            <p style={{ backgroundColor: '#fff3cd', padding: '15px', borderRadius: '5px', border: '1px solid #ffeeba' }}>
                Once you hit your limit, your Visualizer will stop processing images to prevent further charges.
                If you expect high traffic, please increase your limit in the dashboard.
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
                    Update Spending Limit
                </a>
            </p>

            <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

            <p style={{ fontSize: '0.9em', color: '#666' }}>
                Railify AI
            </p>
        </div>
    );
}

export default UsageWarningEmail;
