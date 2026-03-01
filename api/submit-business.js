// api/submit-business.js
// Handles new business submissions (free and paid)
// Saves to Supabase when configured, otherwise falls back to local JSON file

const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const {
            businessName, category, email, phone,
            address, postcode, description, website,
            instagram, twitter, linkedin, openingHours,
            specialOffers, targetAudience,
            tier, billingFrequency,
            stripeCustomerId, stripeSubscriptionId
        } = req.body;

        // Validate required fields
        if (!businessName || !category || !email) {
            return res.status(400).json({ error: 'Business name, category and email are required' });
        }

        const status = tier === 'free' ? 'pending' : 'pending_payment';
        let useSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

        let businessId;
        let record;

        if (!useSupabase) {
            console.error('Supabase credentials missing — SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
            return res.status(500).json({ error: 'Server misconfiguration: database not configured' });
        }

        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );

        // Enforce tier field permissions server-side
        const isFree     = !tier || tier === 'free';
        const isFeatured = tier === 'featured' || tier === 'premium' || tier === 'newsletter';
        const isPremium  = tier === 'premium' || tier === 'newsletter';

        const { data, error: supabaseError } = await supabase
            .from('businesses')
            .insert([{
                business_name: businessName,
                category,
                email,
                phone,
                address,
                postcode,
                description,
                website:          isFeatured ? website : null,
                instagram:        isPremium  ? instagram : null,
                twitter:          isPremium  ? twitter   : null,
                linkedin:         isPremium  ? linkedin  : null,
                opening_hours:    isFeatured ? openingHours   : null,
                special_offers:   isPremium  ? specialOffers  : null,
                target_audience:  isPremium  ? targetAudience : null,
                tier: tier || 'free',
                status,
                billing_frequency: billingFrequency,
                stripe_customer_id: stripeCustomerId,
                stripe_subscription_id: stripeSubscriptionId
            }])
            .select()
            .single();

        if (supabaseError) {
            console.error('Supabase insert failed:', supabaseError);
            return res.status(500).json({ error: 'Failed to save submission', detail: supabaseError.message });
        }

        businessId = data.id;
        record = data;

        // Send approval email to admin (free listings only)
        // Wrapped in its own try/catch so an SMTP failure never blocks the submission
        if (tier === 'free') {
            try {
                await sendApprovalEmail(record, businessId);
            } catch (emailErr) {
                console.error('Approval email failed (submission still saved):', emailErr.message);
            }
        }

        return res.status(200).json({
            success: true,
            submissionId: businessId,
            message: tier === 'free'
                ? 'Submission received. You will be notified once approved.'
                : 'Details saved. Redirecting to payment.'
        });

    } catch (err) {
        console.error('Submit business error:', err);
        return res.status(500).json({ error: 'Internal server error', detail: err.message });
    }
};

async function sendApprovalEmail(business, businessId) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('SMTP credentials not configured — skipping approval email for submission', businessId);
        return;
    }

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@oldoaktown.co.uk';

    const approveUrl = `${process.env.SITE_URL}/api/approve-business?id=${businessId}&action=approve&token=${process.env.ADMIN_TOKEN}`;
    const rejectUrl = `${process.env.SITE_URL}/api/approve-business?id=${businessId}&action=reject&token=${process.env.ADMIN_TOKEN}`;

    const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #2D5016; color: white; padding: 20px; text-align: center;">
                <h1>New Business Listing Submission</h1>
                <p>Old Oak Town Directory</p>
            </div>
            <div style="padding: 30px; background: #f9f9f9;">
                <h2 style="color: #2D5016;">${business.business_name}</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Category:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${business.category}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Email:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${business.email}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Phone:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${business.phone || 'Not provided'}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Address:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${business.address || 'Not provided'}, ${business.postcode || ''}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Website:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${business.website || 'Not provided'}</td></tr>
                    <tr><td style="padding: 8px;"><strong>Description:</strong></td><td style="padding: 8px;">${business.description || 'Not provided'}</td></tr>
                </table>

                <div style="margin-top: 30px; text-align: center;">
                    <a href="${approveUrl}" style="background: #2D5016; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin-right: 10px; font-weight: bold; display: inline-block;">
                        ✅ APPROVE LISTING
                    </a>
                    <a href="${rejectUrl}" style="background: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                        ❌ REJECT LISTING
                    </a>
                </div>
                <p style="text-align: center; color: #666; margin-top: 15px; font-size: 0.9rem;">
                    Submission ID: ${businessId}<br>
                    Submitted: ${new Date().toLocaleString('en-GB')}
                </p>
            </div>
        </div>
    `;

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    await transporter.sendMail({
        from: `"Old Oak Town" <${ADMIN_EMAIL}>`,
        to: ADMIN_EMAIL,
        subject: `New Free Listing Submission: ${business.business_name}`,
        html: emailHtml
    });
}
