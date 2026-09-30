'use server';

import { createClient } from '@supabase/supabase-js';

// We use the admin service role to bypass email confirmation limits
export async function adminSignUp(formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const fullName = formData.get('fullName') as string;

    if (!email || !password) {
        return { error: 'Email and password are required' };
    }

    try {
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName,
            },
        });

        if (error) throw error;

        return { user: data.user, error: null };
    } catch (error: any) {
        console.error('Admin Sign Up Error:', error);
        return { user: null, error: error.message };
    }
}

export async function requestPasswordReset(email: string) {
    if (!email || !email.includes('@')) {
        return { error: 'Please provide a valid email address' };
    }

    try {
        const cleanEmail = email.trim().toLowerCase();
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const supabase = createAdminClient();
        if (!supabase) return { error: 'Server configuration error' };

        const { headers } = await import('next/headers');
        const headersList = await headers();
        const host = headersList.get('x-forwarded-host') || headersList.get('host');
        let origin: string;
        if (host) {
            const proto = headersList.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
            origin = `${proto}://${host}`;
        } else {
            origin = process.env.NEXT_PUBLIC_APP_URL || 'https://railify.app';
        }
        const redirectTo = `${origin}/auth/callback?next=/reset-password`;

        // 1. Generate recovery link with Supabase Admin
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: 'recovery',
            email: cleanEmail,
            options: { redirectTo },
        });

        if (linkError) {
            console.warn('[requestPasswordReset] generateLink result:', linkError.message);
            // Return generic success to prevent email enumeration attacks
            return { success: true };
        }

        const directLink = linkData?.properties?.action_link;
        if (directLink && process.env.RESEND_API_KEY) {
            const { Resend } = await import('resend');
            const resend = new Resend(process.env.RESEND_API_KEY);

            await resend.emails.send({
                from: 'Railify <notifications@railify.app>',
                to: cleanEmail,
                subject: 'Reset your Railify account password',
                html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #050505; color: #ffffff; border-radius: 12px; border: 1px solid #222;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #7C3AED; font-size: 28px; font-weight: 900; letter-spacing: -1px; margin: 0; text-transform: uppercase;">Railify</h1>
                        <p style="color: #888888; font-size: 11px; font-family: monospace; letter-spacing: 2px; text-transform: uppercase; margin-top: 5px;">Security & Password Recovery</p>
                    </div>
                    
                    <div style="background-color: #111111; border: 1px solid #222222; border-radius: 8px; padding: 30px; margin-bottom: 24px;">
                        <h2 style="color: #ffffff; font-size: 18px; margin-top: 0; margin-bottom: 12px;">Reset Your Password</h2>
                        <p style="color: #aaaaaa; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
                            Hello,<br/><br/>
                            We received a request to reset the password for your Railify account. Click the button below to choose a new password:
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${directLink}" style="background-color: #7C3AED; color: #ffffff; font-weight: bold; text-decoration: none; padding: 14px 32px; border-radius: 8px; display: inline-block; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                                Reset Password
                            </a>
                        </div>
                        
                        <p style="color: #666666; font-size: 12px; line-height: 1.5; margin-bottom: 0;">
                            If the button above does not work, copy and paste this link into your browser:<br/>
                            <a href="${directLink}" style="color: #7C3AED; word-break: break-all;">${directLink}</a>
                        </p>
                    </div>
                    
                    <div style="text-align: center; font-size: 11px; color: #555555;">
                        <p style="margin: 0;">This password reset link will expire in 24 hours. If you did not request this, you can safely ignore this email.</p>
                        <p style="margin-top: 10px;">&copy; Railify &bull; Mississippi Metal Magic</p>
                    </div>
                </div>
                `,
            });
        }

        return { success: true };
    } catch (err: any) {
        console.error('[requestPasswordReset error]:', err);
        return { error: err.message || 'Failed to send recovery email' };
    }
}
