// api/_shared/resend.js
// Thin wrapper around the Resend transactional email API.
// Uses the global fetch available in Node 18+, so no extra dependency is
// needed. Replaces Gmail SMTP (via nodemailer) for the paid/free listing
// approval and cancellation emails, since Gmail's SMTP repeatedly rejected
// app-password auth from server-side sending even after regenerating the
// password and validating the sign-in.

const DEFAULT_FROM = 'Old Oak Town <notifications@oldoaktown.co.uk>';

async function sendEmail({ to, subject, html, from }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        throw new Error('RESEND_API_KEY is not configured');
    }

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: from || process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
            to,
            subject,
            html
        })
    });

    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Resend API error (${res.status}): ${detail}`);
    }

    return res.json();
}

module.exports = { sendEmail };
