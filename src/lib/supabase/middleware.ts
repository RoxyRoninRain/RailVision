import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    // --- CSP & FRAME PROTECTION ---
    // Default CSP (Self + Railify + Localhost)
    let allowedDomains = [
        "'self'",
        "http://localhost:*",
        "https://railify.app",
        "https://*.railify.app"
    ];

    // Get org parameter to check specific tenant
    const orgId = request.nextUrl.searchParams.get('org');
    
    // Add mississippimetalmagic as a safe fallback
    allowedDomains.push("https://mississippimetalmagic.com");
    allowedDomains.push("https://www.mississippimetalmagic.com");

    if (orgId) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
            try {
                // Fetch the specific tenant profile
                const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${orgId}&select=website,subscription_status`, {
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) {
                        const profile = data[0];
                        if (profile.subscription_status === 'active' || profile.subscription_status === 'trialing') {
                            if (profile.website) {
                                // Extract clean domain
                                const cleanDomain = profile.website.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '').toLowerCase();
                                allowedDomains.push(`https://${cleanDomain}`);
                                allowedDomains.push(`https://www.${cleanDomain}`);
                            }
                        }
                    }
                }
            } catch (dbError) {
                console.error('Middleware DB error:', dbError);
            }
        }
    }

    // Construct CSP Header
    const csp = `frame-ancestors ${allowedDomains.join(' ')};`;
    response.headers.set('Content-Security-Policy', csp);
    // REMOVED: X-Frame-Options: SAMEORIGIN because it completely breaks cross-origin iframes regardless of CSP
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
