import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Railify — AI Handrail & Stair Railing Visualizer + Instant Quote Estimator for Custom Fabricators';
export const size = {
    width: 1200,
    height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    backgroundColor: '#050505',
                    backgroundImage:
                        'radial-gradient(circle at 20% 20%, rgba(255, 215, 0, 0.16), transparent 45%), radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.14), transparent 45%)',
                    padding: '64px 72px',
                    color: '#ffffff',
                    fontFamily: 'sans-serif',
                    border: '2px solid rgba(255, 255, 255, 0.08)',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                        }}
                    >
                        <div
                            style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                backgroundColor: '#FFD700',
                                color: '#000000',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '28px',
                                fontWeight: 900,
                            }}
                        >
                            R
                        </div>
                        <span
                            style={{
                                fontSize: '32px',
                                fontWeight: 800,
                                letterSpacing: '-0.03em',
                                color: '#ffffff',
                            }}
                        >
                            RAILIFY
                        </span>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px 22px',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(255, 215, 0, 0.12)',
                            border: '1px solid rgba(255, 215, 0, 0.35)',
                            color: '#FFD700',
                            fontSize: '18px',
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                        }}
                    >
                        AI Handrail Visualizer & Quote Estimator
                    </div>
                </div>

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                        maxWidth: '980px',
                    }}
                >
                    <div
                        style={{
                            fontSize: '68px',
                            fontWeight: 900,
                            lineHeight: 1.06,
                            letterSpacing: '-0.04em',
                            color: '#ffffff',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        <span>Hook Them With Visuals.</span>
                        <span style={{ color: '#FFD700' }}>Filter Them With Price.</span>
                    </div>
                    <div
                        style={{
                            fontSize: '26px',
                            lineHeight: 1.4,
                            color: '#a1a1aa',
                            maxWidth: '900px',
                        }}
                    >
                        White-label AI stair & deck railing visualization + instant linear-foot quote estimation for custom metal fabricators and railing contractors.
                    </div>
                </div>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                        paddingTop: '28px',
                        fontSize: '20px',
                        color: '#d4d4d8',
                    }}
                >
                    <div style={{ display: 'flex', gap: '32px' }}>
                        <span>✓ Photorealistic Staircase AI</span>
                        <span>✓ Instant Price Filtering</span>
                        <span>✓ 100% White-Label Embed</span>
                    </div>
                    <span style={{ color: '#FFD700', fontWeight: 700 }}>railify.app</span>
                </div>
            </div>
        ),
        {
            ...size,
        }
    );
}
