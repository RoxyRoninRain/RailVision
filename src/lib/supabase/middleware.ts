import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isValidUuid } from '@/lib/validations'

export async function updateSession(request: NextRequest) {
    const response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    // --- CSP & FRAME PROTECTION ---
    // Default CSP (Self + Railify + Localhost)
    const allowedDomains = [
        "'self'",
        "http://localhost:*",
        "https://railify.app",
        "https://*.railify.app",
        "https://mississippimetalmagic.com",
        "https://www.mississippimetalmagic.com",
    ];

    // Get org parameter to check specific tenant's authorized embed domain(s)
    const orgId = request.nextUrl.searchParams.get('org');

    if (orgId && isValidUuid(orgId)) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        // Use service_role key on the server because RLS on `profiles` blocks `anon` reads;
        // `orgId` is strictly UUID-validated above and only `website,subscription_status` are read.
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || supabaseKey;

        if (supabaseUrl && supabaseKey && anonKey) {
            try {
                const res = await fetch(
                    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(orgId.trim())}&select=website,subscription_status`,
                    {
                        headers: {
                            'apikey': anonKey,
                            'Authorization': `Bearer ${supabaseKey}`
                        }
                    }
                );

                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) {
                        const profile = data[0];
                        if (profile.subscription_status === 'active' || profile.subscription_status === 'trialing') {
                            if (profile.website) {
                                const DOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
                                const rawDomains = String(profile.website).split(',').map((d: string) => d.trim()).filter(Boolean);
                                for (const rawDomain of rawDomains) {
                                    const cleanDomain = rawDomain.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '').toLowerCase();
                                    if (cleanDomain && DOMAIN_REGEX.test(cleanDomain)) {
                                        allowedDomains.push(`https://${cleanDomain}`);
                                        allowedDomains.push(`https://www.${cleanDomain}`);
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (dbError) {
                console.error('Middleware DB error:', dbError);
            }
        }
    }

    // Construct CSP & Defensive Headers (Note: X-Frame-Options is intentionally omitted so cross-origin tenant iframes work via frame-ancestors)
    const csp = `frame-ancestors ${Array.from(new Set(allowedDomains)).join(' ')};`;
    response.headers.set('Content-Security-Policy', csp);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=*, microphone=(), geolocation=()');
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
