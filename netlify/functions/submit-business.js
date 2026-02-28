// netlify/functions/submit-business.js
// Handles new business submissions for Netlify deployments.
// Mirrors api/submit-business.js but uses the Netlify Functions
// handler signature (event) instead of Express (req / res).

const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const body = JSON.parse(event.body || '{}');

        const {
            businessName, category, email, phone,
            address, postcode, description, website,
            instagram, twitter, linkedin, openingHours,
            specialOffers, targetAudience,
            tier, billingFrequency,
            stripeCustomerId, stripeSubscriptionId
        } = body;

        if (!businessName || !category || !email) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Business name, category and email are required' })
            };
        }

        // ── Supabase insert ───────────────────────────────────────────────────
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
            console.error('SUPABASE_URL or SUPABASE_SERVICE_KEY not set');
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Server misconfiguration: Supabase credentials missing' })
            };
        }

        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );

        const status = tier === 'free' ? 'pending' : 'pending_payment';

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
                website,
                instagram,
                twitter,
                linkedin,
                opening_hours: openingHours,
                special_offers: specialOffers,
                target_audience: targetAudience,
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
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Failed to save submission', detail: supabaseError.message })
            };
        }

        const businessId = data.id;

        // ── Admin approval email (free tier only) ─────────────────────────────
        if (tier === 'free') {
            try {
                await sendApprovalEmail(data, businessId);
            } catch (emailErr) {
                console.error('Approval email failed (submission still saved):', emailErr.message);
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                submissionId: businessId,
                message: tier === 'free'
                    ? 'Submission received. You will be notified once approved.'
                    : 'Details saved. Redirecting to payment.'
            })
        };

    } catch (err) {
        console.error('Submit business error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error', detail: err.message })
        };
    }
};

async function sendApprovalEmail(business, businessId) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('SMTP credentials not configured — skipping approval email for', businessId);
        return;
    }

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@oldoaktown.co.uk';
    const SITE_URL = process.env.SITE_URL || 'https://www.oldoaktown.co.uk';

    const approveUrl = `${SITE_URL}/api/approve-business?id=${businessId}&action=approve&token=${process.env.ADMIN_TOKEN}`;
    const rejectUrl  = `${SITE_URL}/api/approve-business?id=${businessId}&action=reject&token=${process.env.ADMIN_TOKEN}`;

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
        port: Number(process.env.SMTP_PORT) || 587,
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
