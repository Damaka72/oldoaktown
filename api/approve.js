// api/approve.js
// Consolidated admin approval endpoint. Merges what used to be three separate
// serverless functions into one file to stay under the Vercel Hobby plan's
// function-per-deployment limit. External URLs are preserved via rewrites in
// vercel.json, so existing callers (admin dashboard, email approval links)
// are unaffected:
//
//   /api/approve-business  → /api/approve?kind=business  (GET,  email links, ADMIN_TOKEN)
//   /api/approve-event     → /api/approve?kind=event     (POST, admin,       ADMIN_PASSWORD)
//   /api/approve-listing   → /api/approve?kind=listing   (POST, admin,       ADMIN_PASSWORD)

const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

const VALID_CATEGORIES = ['hs2', 'planning', 'housing', 'community', 'business', 'investment', 'other'];
const FEATURED_PRICE = 35;
const PREMIUM_PRICE  = 75;

module.exports = async function handler(req, res) {
    // Resolve which sub-handler to run. `kind` is injected by the vercel.json
    // rewrites; fall back to method-based inference if hit directly.
    let kind = (req.query && req.query.kind) || '';
    if (!kind) {
        kind = req.method === 'GET' ? 'business' : 'listing';
    }

    if (kind === 'business') return handleBusiness(req, res);
    if (kind === 'event')    return handleEvent(req, res);
    if (kind === 'listing')  return handleListing(req, res);

    return res.status(400).json({ error: 'Unknown approval kind' });
};

// ─── BUSINESS (email approve/reject links) ──────────────────────────────────
// Was api/approve-business.js. GET with { id, action, token }.
async function handleBusiness(req, res) {
    const { id, action, token } = req.query;

    if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
        return res.status(403).send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:50px;">
                <h2 style="color:#dc3545;">❌ Unauthorised</h2>
                <p>Invalid token. Please use the link from your email.</p>
            </body></html>
        `);
    }

    if (!id || !['approve', 'reject'].includes(action)) {
        return res.status(400).send('Invalid request');
    }

    try {
        const { data: business, error: fetchError } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !business) {
            return res.status(404).send(`
                <html><body style="font-family:sans-serif;text-align:center;padding:50px;">
                    <h2 style="color:#dc3545;">❌ Business Not Found</h2>
                    <p>This listing may have already been processed.</p>
                </body></html>
            `);
        }

        if (action === 'approve') {
            const { error: updateError } = await supabase
                .from('businesses')
                .update({
                    status: 'approved',
                    approved_at: new Date().toISOString()
                })
                .eq('id', id);

            if (updateError) throw updateError;

            try {
                await sendBusinessNotification(business, 'approved');
            } catch (emailErr) {
                console.error('Failed to send approval notification:', emailErr.message);
            }

            return res.send(`
                <html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#f9f9f9;">
                    <div style="max-width:500px;margin:0 auto;background:white;padding:40px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color:#2D5016;">✅ Listing Approved</h2>
                        <h3>${business.business_name}</h3>
                        <p>The listing is now live on the Old Oak Town directory.</p>
                        <p style="color:#666;">The business owner has been notified by email.</p>
                        <a href="https://www.oldoaktown.co.uk/business-directory.html"
                           style="background:#2D5016;color:white;padding:12px 25px;text-decoration:none;border-radius:5px;display:inline-block;margin-top:20px;">
                            View Directory
                        </a>
                    </div>
                </body></html>
            `);

        } else {
            const { error: updateError } = await supabase
                .from('businesses')
                .update({ status: 'rejected' })
                .eq('id', id);

            if (updateError) throw updateError;

            try {
                await sendBusinessNotification(business, 'rejected');
            } catch (emailErr) {
                console.error('Failed to send rejection notification:', emailErr.message);
            }

            return res.send(`
                <html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#f9f9f9;">
                    <div style="max-width:500px;margin:0 auto;background:white;padding:40px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color:#dc3545;">❌ Listing Rejected</h2>
                        <h3>${business.business_name}</h3>
                        <p>The listing has been rejected and the business owner notified.</p>
                    </div>
                </body></html>
            `);
        }

    } catch (err) {
        console.error('Approve business error:', err);
        return res.status(500).send('Internal server error');
    }
}

async function sendBusinessNotification(business, decision) {
    const approvedHtml = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#2D5016;color:white;padding:20px;text-align:center;">
                <h1>Your Listing is Live! 🎉</h1>
                <p>Old Oak Town Business Directory</p>
            </div>
            <div style="padding:30px;">
                <p>Great news! Your business listing for <strong>${business.business_name}</strong> has been approved and is now live on the Old Oak Town directory.</p>
                <p style="margin-top:20px;">
                    <a href="https://www.oldoaktown.co.uk/business-directory.html"
                       style="background:#2D5016;color:white;padding:12px 25px;text-decoration:none;border-radius:5px;display:inline-block;">
                        View Your Listing
                    </a>
                </p>
                <p style="margin-top:30px;color:#666;">Want more visibility?
                    <a href="https://www.oldoaktown.co.uk/business-submit.html" style="color:#2D5016;">Upgrade to Featured for £35/month</a>
                </p>
                <hr style="margin:30px 0;border:none;border-top:1px solid #eee;">
                <p style="color:#999;font-size:0.85rem;">Old Oak Town · info@oldoaktown.co.uk</p>
            </div>
        </div>
    `;

    const rejectedHtml = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#2D5016;color:white;padding:20px;text-align:center;">
                <h1>Listing Update</h1>
                <p>Old Oak Town Business Directory</p>
            </div>
            <div style="padding:30px;">
                <p>Thank you for submitting <strong>${business.business_name}</strong> to the Old Oak Town directory.</p>
                <p style="margin-top:15px;">Unfortunately we were unable to approve your listing at this time. This may be because the business is outside our coverage area or the information provided was incomplete.</p>
                <p style="margin-top:15px;">Please contact us at <a href="mailto:info@oldoaktown.co.uk" style="color:#2D5016;">info@oldoaktown.co.uk</a> if you have any questions.</p>
                <hr style="margin:30px 0;border:none;border-top:1px solid #eee;">
                <p style="color:#999;font-size:0.85rem;">Old Oak Town · info@oldoaktown.co.uk</p>
            </div>
        </div>
    `;

    await transporter.sendMail({
        from: `"Old Oak Town" <${process.env.ADMIN_EMAIL || 'info@oldoaktown.co.uk'}>`,
        to: business.email,
        subject: decision === 'approved'
            ? `Your Old Oak Town listing is live! - ${business.business_name}`
            : `Old Oak Town listing update - ${business.business_name}`,
        html: decision === 'approved' ? approvedHtml : rejectedHtml
    });
}

// ─── EVENT (admin dashboard) ────────────────────────────────────────────────
// Was api/approve-event.js. POST with { eventId, action, password, event }.
async function handleEvent(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { eventId, action = 'approve', password, event } = req.body || {};

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || password !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        if (action === 'list') {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .order('event_date', { ascending: true });
            if (error) throw error;
            return res.status(200).json({ success: true, events: data || [] });
        }

        if (action === 'create') {
            const e = event || {};
            if (!e.title || !e.eventDate) {
                return res.status(400).json({ error: 'Event title and date are required' });
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(e.eventDate)) {
                return res.status(400).json({ error: 'Event date must be in YYYY-MM-DD format' });
            }
            const cat = VALID_CATEGORIES.includes(e.category) ? e.category : 'community';
            const { data, error } = await supabase
                .from('events')
                .insert([{
                    title: e.title,
                    description: e.description || null,
                    category: cat,
                    event_date: e.eventDate,
                    start_time: e.startTime || null,
                    end_time: e.endTime || null,
                    location: e.location || null,
                    postcode: e.postcode || null,
                    organiser_name: e.organiserName || null,
                    source: 'manual',
                    source_url: e.sourceUrl || null,
                    status: 'approved',
                    approved_at: new Date().toISOString(),
                    approved_by: 'admin'
                }])
                .select()
                .single();
            if (error) throw error;
            return res.status(200).json({ success: true, event: data });
        }

        if (!eventId) {
            return res.status(400).json({ error: 'Missing eventId' });
        }

        if (action === 'delete') {
            const { error } = await supabase.from('events').delete().eq('id', eventId);
            if (error) throw error;
            return res.status(200).json({ success: true, message: 'Event deleted' });
        }

        const updates = {};
        if (action === 'approve') {
            updates.status = 'approved';
            updates.approved_at = new Date().toISOString();
            updates.approved_by = 'admin';
        } else if (action === 'reject') {
            updates.status = 'rejected';
        } else if (action === 'suspend') {
            updates.status = 'pending';
        } else {
            return res.status(400).json({ error: 'Invalid action. Use list, create, approve, reject, suspend, or delete.' });
        }

        const { data, error } = await supabase
            .from('events')
            .update(updates)
            .eq('id', eventId)
            .select()
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Event not found' });

        console.log(`Event ${action}d: ${data.title} (${eventId})`);
        return res.status(200).json({ success: true, message: `Event ${action}d successfully`, title: data.title });

    } catch (err) {
        console.error('approve-event error:', err);
        return res.status(500).json({ error: 'Failed to update event', detail: err.message });
    }
}

// ─── LISTING (admin dashboard + stats) ──────────────────────────────────────
// Was api/approve-listing.js. POST with { submissionId, action, password }.
async function handleListing(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { submissionId, action = 'approve', password } = req.body || {};

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || password !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (action === 'stats') {
        try {
            const [{ data: businesses, error: bizErr }, { data: videos, error: vidErr }] = await Promise.all([
                supabase
                    .from('businesses')
                    .select('id, status, tier, stripe_payment_status')
                    .neq('status', 'rejected'),
                supabase
                    .from('videos')
                    .select('id, active')
                    .eq('active', true)
            ]);

            if (bizErr) throw bizErr;

            const pending        = (businesses || []).filter(b => b.status === 'pending').length;
            const approved       = (businesses || []).filter(b => b.status === 'approved').length;
            const featured       = (businesses || []).filter(b => b.status === 'approved' && b.tier === 'featured').length;
            const premium        = (businesses || []).filter(b => b.status === 'approved' && b.tier === 'premium').length;
            const videosLive     = vidErr ? 0 : (videos || []).length;
            const monthlyRevenue = (featured * FEATURED_PRICE) + (premium * PREMIUM_PRICE);

            return res.status(200).json({
                pendingBusinesses:  pending,
                approvedBusinesses: approved,
                featuredBusinesses: featured,
                premiumBusinesses:  premium,
                videosLive,
                monthlyRevenue,
                reviewQueue: 0
            });
        } catch (err) {
            console.error('approve-listing stats error:', err);
            return res.status(500).json({ error: 'Failed to fetch stats' });
        }
    }

    if (!submissionId) {
        return res.status(400).json({ error: 'Missing submissionId' });
    }

    try {
        const { data: business, error: fetchError } = await supabase
            .from('businesses')
            .select('id, business_name, status')
            .eq('id', submissionId)
            .single();

        if (fetchError || !business) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        const updates = {};
        if (action === 'approve') {
            updates.status = 'approved';
            updates.approved_at = new Date().toISOString();
        } else if (action === 'reject') {
            updates.status = 'rejected';
        } else if (action === 'suspend') {
            updates.status = 'pending';
        } else {
            return res.status(400).json({ error: 'Invalid action. Use approve, reject, suspend, or stats.' });
        }

        const { error: updateError } = await supabase
            .from('businesses')
            .update(updates)
            .eq('id', submissionId);

        if (updateError) throw updateError;

        console.log(`Listing ${action}d: ${business.business_name} (${submissionId})`);

        return res.status(200).json({
            success: true,
            message: `Listing ${action}d successfully`,
            businessName: business.business_name
        });

    } catch (err) {
        console.error('approve-listing error:', err);
        return res.status(500).json({ error: 'Failed to update listing' });
    }
}
