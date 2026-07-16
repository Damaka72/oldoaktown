// api/submit-event.js
// Handles new community event submissions from event-submit.html
// Inserts into the Supabase `events` table with status 'pending' (HITL review),
// then notifies the admin by email (best-effort). Nothing goes live until an
// admin approves it in the dashboard.

const { createClient } = require('@supabase/supabase-js');
const { sendEmail } = require('./_shared/resend');

const VALID_CATEGORIES = ['hs2', 'planning', 'housing', 'community', 'business', 'investment', 'other'];

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const {
            title, description, category,
            eventDate, startTime, endTime,
            location, postcode,
            organiserName, organiserEmail, sourceUrl
        } = req.body || {};

        // Validate required fields
        if (!title || !eventDate) {
            return res.status(400).json({ error: 'Event title and date are required' });
        }

        // Basic date sanity check (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
            return res.status(400).json({ error: 'Event date must be in YYYY-MM-DD format' });
        }

        const cat = VALID_CATEGORIES.includes(category) ? category : 'community';

        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
            console.error('Supabase credentials missing — SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
            return res.status(500).json({ error: 'Server misconfiguration: database not configured' });
        }

        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );

        const { data, error: supabaseError } = await supabase
            .from('events')
            .insert([{
                title,
                description: description || null,
                category: cat,
                event_date: eventDate,
                start_time: startTime || null,
                end_time: endTime || null,
                location: location || null,
                postcode: postcode || null,
                organiser_name: organiserName || null,
                organiser_email: organiserEmail || null,
                source: 'community_submission',
                source_url: sourceUrl || null,
                status: 'pending'
            }])
            .select()
            .single();

        if (supabaseError) {
            console.error('Supabase insert failed:', supabaseError);
            return res.status(500).json({ error: 'Failed to save submission', detail: supabaseError.message });
        }

        // Notify admin (best-effort — an email failure must never block the submission)
        try {
            await sendSubmissionEmail(data);
        } catch (emailErr) {
            console.error('Event notification email failed (submission still saved):', emailErr.message);
        }

        return res.status(200).json({
            success: true,
            submissionId: data.id,
            message: 'Thank you — your event has been submitted for review. It will appear once approved.'
        });

    } catch (err) {
        console.error('Submit event error:', err);
        return res.status(500).json({ error: 'Internal server error', detail: err.message });
    }
};

async function sendSubmissionEmail(ev) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY not configured — skipping event notification for', ev.id);
        return;
    }

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@oldoaktown.co.uk';
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #2D5016; color: white; padding: 20px; text-align: center;">
                <h1>New Community Event Submission</h1>
                <p>Old Oak Town Events Calendar</p>
            </div>
            <div style="padding: 30px; background: #f9f9f9;">
                <h2 style="color: #2D5016;">${esc(ev.title)}</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Date:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${esc(ev.event_date)}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Time:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${esc(ev.start_time || 'TBC')}${ev.end_time ? ' – ' + esc(ev.end_time) : ''}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Category:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${esc(ev.category)}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Location:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${esc(ev.location || 'Not provided')} ${esc(ev.postcode || '')}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Organiser:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${esc(ev.organiser_name || 'Not provided')} ${ev.organiser_email ? '(' + esc(ev.organiser_email) + ')' : ''}</td></tr>
                    <tr><td style="padding: 8px;"><strong>Description:</strong></td><td style="padding: 8px;">${esc(ev.description || 'Not provided')}</td></tr>
                </table>
                <p style="text-align: center; margin-top: 25px;">
                    <a href="${process.env.SITE_URL || 'https://oldoaktown.co.uk'}/admin/dashboard.html" style="background: #2D5016; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                        Review in Admin Dashboard →
                    </a>
                </p>
                <p style="text-align: center; color: #666; margin-top: 15px; font-size: 0.9rem;">
                    Submission ID: ${esc(ev.id)}<br>
                    Submitted: ${new Date().toLocaleString('en-GB')}
                </p>
            </div>
        </div>
    `;

    await sendEmail({
        to: ADMIN_EMAIL,
        subject: `New Event Submission: ${ev.title}`,
        html: emailHtml
    });
}
