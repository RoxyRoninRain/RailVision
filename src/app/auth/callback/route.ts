import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next') ?? '/dashboard/leads';
    const errorParam = searchParams.get('error');
    const errorDesc = searchParams.get('error_description');

    console.log(`[AUTH CALLBACK] Hit. Code: ${code ? 'YES' : 'NO'}, Error: ${errorParam}, Next: ${next}`);

    if (errorParam) {
        console.error('[AUTH CALLBACK] Supabase Error:', errorParam, errorDesc);
        return NextResponse.redirect(`${origin}/login?error=${errorParam}&message=${encodeUIC(errorDesc || '')}`);
    }

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            console.log('[AUTH CALLBACK] Session Exchanged Successfully. Redirecting to:', next);

            const forwardedHost = request.headers.get('x-forwarded-host');
            const isLocal = origin.includes('localhost');

            if (isLocal) {
                return NextResponse.redirect(`${origin}${next}`);
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${next}`);
            } else {
                return NextResponse.redirect(`${origin}${next}`);
            }
        } else {
            console.error('[AUTH CALLBACK] Exchange Error:', error);
            // Fallthrough to error redirect
            return NextResponse.redirect(`${origin}/login?error=exchange_failed&message=${encodeUIC(error.message)}`);
        }
    }

    console.warn('[AUTH CALLBACK] No code and no error provided.');
    return NextResponse.redirect(`${origin}/login?error=no_code`);
}

function encodeUIC(str: string) {
    return encodeURIComponent(str).replace(/%20/g, '+');
}
