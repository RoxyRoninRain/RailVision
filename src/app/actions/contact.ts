'use server';

import { Resend } from 'resend';
import { headers } from 'next/headers';
import { checkRateLimit, extractClientIp } from '@/lib/rate-limit';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function submitContactForm(formData: FormData) {
    const headersList = await headers();
    const clientIp = extractClientIp(headersList);
    const rl = checkRateLimit('contact-form', clientIp, 5, 15 * 60 * 1000);
    if (!rl.allowed) {
        return { success: false, error: 'Too many submissions. Please wait a few minutes and try again.' };
    }

    const name = (formData.get('name') as string)?.trim().slice(0, 120);
    const email = (formData.get('email') as string)?.trim().slice(0, 254);
    const subject = (formData.get('subject') as string)?.trim().slice(0, 200);
    const message = (formData.get('message') as string)?.trim().slice(0, 5000);

    if (!email || !message) {
        return { success: false, error: 'Email and message are required.' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { success: false, error: 'Please enter a valid email address.' };
    }

    // Sanitize inputs to prevent XSS in HTML emails
    const escapeHtml = (str: string | null | undefined): string => {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);

    try {
        if (process.env.RESEND_API_KEY) {
            const { error } = await resend.emails.send({
                from: 'Railify Contact <notifications@railify.app>',
                to: process.env.ADMIN_EMAIL?.trim() || 'railifyai@gmail.com',
                replyTo: email,
                subject: `[Contact Form] ${safeSubject || 'New Inquiry'}`,
                html: `
          <div style="font-family: sans-serif; color: #333;">
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> ${safeName || 'N/A'}</p>
            <p><strong>Email:</strong> ${safeEmail}</p>
            <p><strong>Subject:</strong> ${safeSubject || 'N/A'}</p>
            <hr />
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-wrap;">${safeMessage}</p>
          </div>
        `
            });

            if (error) {
                console.error('Contact Form Resend Error:', error);
                return { success: false, error: 'Failed to send email.' };
            }
        } else {
            console.warn('RESEND_API_KEY is missing. Contact form email skipped in local environment.');
        }

        return { success: true };

    } catch (err) {
        console.error('Contact Form Validation Error:', err);
        return { success: false, error: 'Internal server error.' };
    }
}
