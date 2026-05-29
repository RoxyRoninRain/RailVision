'use server';

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function submitContactForm(formData: FormData) {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const subject = formData.get('subject') as string;
    const message = formData.get('message') as string;

    if (!email || !message) {
        return { success: false, error: 'Email and message are required.' };
    }

    // Sanitize inputs to prevent XSS in HTML emails
    const escapeHtml = (str: string | null): string => {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    };

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);

    try {
        if (process.env.RESEND_API_KEY) {
            const { error } = await resend.emails.send({
                from: 'Railify Contact <notifications@railify.app>',
                to: 'railifyai@gmail.com',
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
            console.warn('RESEND_API_KEY is missing. Logging contact form submission instead.');
            console.log('Contact Form Submission:', { name, email, subject, message });
        }

        return { success: true };

    } catch (err) {
        console.error('Contact Form Validation Error:', err);
        return { success: false, error: 'Internal server error.' };
    }
}
