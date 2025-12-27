
import * as React from 'react';

export function LimitReachedEmail() {
    return (
        <div style={{ fontFamily: 'sans-serif', lineHeight: '1.5', color: '#333' }}>
            <h2 style={{ color: '#dc2626' }}>⛔ Limit Reached</h2>

            <p>
                You have reached your monthly generation limit.
                Your Visualizer tool will not generate new designs until your next billing cycle
                or until you enable Overdrive.
            </p>

            <p>
                <strong>Don't let your customers hit a dead end.</strong>
            </p>

            <p>
                <a
                    href="https://railify.app/dashboard/settings"
                    style={{
                        display: 'inline-block',
                        backgroundColor: '#dc2626',
                        color: '#fff',
                        padding: '12px 24px',
                        textDecoration: 'none',
                        borderRadius: '5px',
                        fontWeight: 'bold'
                    }}
                >
                    Enable Overdrive to Resume Service
                </a>
            </p>

            <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

            <p style={{ fontSize: '0.9em', color: '#666' }}>
                Railify AI
            </p>
        </div>
    );
}

export default LimitReachedEmail;
