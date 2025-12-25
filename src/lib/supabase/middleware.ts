import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    // --- CSP & FRAME PROTECTION (Ported from middleware.ts.disabled) ---
    // Default CSP (Self + Railify + Localhost)
    let allowedDomains = [
        "'self'",
        "http://localhost:*",
        "https://railify.app",
        "https://*.railify.app"
    ];

    // Check Referer for external embedding
    const referer = request.headers.get('referer');
    if (referer) {
        try {
            const refererUrl = new URL(referer);
            const origin = refererUrl.origin;

            // If it's an external domain, check against whitelist
            if (!origin.includes('railify.app') && !origin.includes('localhost')) {
                // Hardcoded fallback backup
                if (origin === 'https://mississippimetalmagic.com') {
                    allowedDomains.push(origin);
                } else {
                    // Dynamic Database Check using REST for speed/safety
                    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

                    if (supabaseUrl && supabaseKey) {
                        try {
                            // Check profiles for matching website
                            const res = await fetch(`${supabaseUrl}/rest/v1/profiles?website=eq.${encodeURIComponent(origin)}&select=subscription_status`, {
                                headers: {
                                    'apikey': supabaseKey,
                                    'Authorization': `Bearer ${supabaseKey}`
                                }
                            });

                            if (res.ok) {
                                const data = await res.json();
                                if (data && data.length > 0) {
                                    const status = data[0].subscription_status;
                                    if (status === 'active' || status === 'trialing') {
                                        allowedDomains.push(origin);
                                    }
                                }
                            }
                        } catch (dbError) {
                            console.error('Middleware DB error:', dbError);
                        }
                    }
                }
            }
        } catch (e) {
            // Invalid referer, ignore
        }
    }

    // Construct CSP Header
    const csp = `frame-ancestors ${allowedDomains.join(' ')};`;
    response.headers.set('Content-Security-Policy', csp);
    response.headers.set('X-Frame-Options', 'SAMEORIGIN'); // Fallback
    // -------------------------------------------------------------

    // Create Client
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set(name, value)
                        response.cookies.set(name, value, options)
                    })
                },
            },
        }
    )

    // Refresh Session
    const { data: { user } } = await supabase.auth.getUser()

    // Protected Routes Logic
    if (
        !user &&
        (request.nextUrl.pathname.startsWith("/dashboard") ||
            request.nextUrl.pathname.startsWith("/admin"))
    ) {
        const loginUrl = request.nextUrl.clone()
        loginUrl.pathname = '/login'
        return NextResponse.redirect(loginUrl)
    }

    return response
}
