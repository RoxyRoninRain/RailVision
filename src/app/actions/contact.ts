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

    try {
        if (process.env.RESEND_API_KEY) {
            const { error } = await resend.emails.send({
                from: 'Railify Contact <notifications@railify.app>',
                to: 'railifyai@gmail.com',
                replyTo: email,
                subject: `[Contact Form] ${subject || 'New Inquiry'}`,
                html: `
          <div style="font-family: sans-serif; color: #333;">
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> ${name || 'N/A'}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject || 'N/A'}</p>
            <hr />
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-wrap;">${message}</p>
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
