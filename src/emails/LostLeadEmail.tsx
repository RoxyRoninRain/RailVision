
import * as React from 'react';

export function LostLeadEmail() {
    return (
        <div style={{ fontFamily: 'sans-serif', lineHeight: '1.5', color: '#333' }}>
            <h2 style={{ color: '#b91c1c' }}>⚠️ Alert: You just missed a customer!</h2>

            <p style={{ fontSize: '1.1em' }}>
                A visitor on your website just tried to use your Visualizer but was <strong>blocked</strong> because
                your plan limit has been reached.
            </p>

            <p style={{
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                padding: '15px',
                borderRadius: '5px',
                border: '1px solid #fecaca',
                fontWeight: 'bold'
            }}>
                You are losing potential leads right now.
            </p>

            <p>
                Enable Overdrive immediately to capture these customers and allow them to generate designs.
            </p>

            <p style={{ textAlign: 'center', margin: '30px 0' }}>
                <a
                    href="https://railify.app/dashboard/settings"
                    style={{
                        display: 'inline-block',
                        backgroundColor: '#dc2626',
                        color: '#fff',
                        fontSize: '18px',
                        padding: '15px 30px',
                        textDecoration: 'none',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 6px rgba(220, 38, 38, 0.2)'
                    }}
                >
                    ENABLE OVERDRIVE NOW
                </a>
            </p>

            <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

            <p style={{ fontSize: '0.9em', color: '#666' }}>
                Railify AI - Don't miss another lead.
            </p>
        </div>
    );
}

export default LostLeadEmail;
