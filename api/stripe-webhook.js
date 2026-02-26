// api/stripe-webhook.js
// Listens for Stripe payment events
// Upgrades listing tier when payment confirmed, downgrades on cancellation

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
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

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // express.raw() (applied in server.js) already stores the raw body in req.body
    const buf = req.body;
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        event = stripe.webhooks.constructEvent(
            buf,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature error:', err.message);
        return res.status(400).json({ error: `Webhook error: ${err.message}` });
    }

    console.log('Stripe webhook event:', event.type);

    try {
        switch (event.type) {

            case 'checkout.session.completed': {
                const session = event.data.object;
                const submissionId = session.metadata?.submission_id;
                const tier = session.metadata?.tier;

                if (!submissionId) {
                    console.log('No submission_id in metadata, skipping');
                    break;
                }

                const { error } = await supabase
                    .from('businesses')
                    .update({
                        status: 'pending',
                        tier: tier || 'featured',
                        stripe_customer_id: session.customer,
                        stripe_subscription_id: session.subscription,
                        stripe_payment_status: 'active'
                    })
                    .eq('id', submissionId);

                if (error) {
                    console.error('Supabase update error:', error);
                } else {
                    console.log(`Payment confirmed for ${submissionId}, tier: ${tier}`);
                    const { data: business } = await supabase
                        .from('businesses')
                        .select('*')
                        .eq('id', submissionId)
                        .single();
                    if (business) await sendPaidApprovalEmail(business, submissionId);
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const { data: business, error: fetchError } = await supabase
                    .from('businesses')
                    .select('*')
                    .eq('stripe_subscription_id', subscription.id)
                    .single();

                if (!fetchError && business) {
                    await supabase
                        .from('businesses')
                        .update({
                            tier: 'free',
                            stripe_payment_status: 'cancelled',
                            stripe_subscription_id: null
                        })
                        .eq('id', business.id);
                    console.log(`${business.business_name} downgraded to free`);
                    await sendCancellationEmail(business);
                }
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                if (invoice.subscription) {
                    await supabase
                        .from('businesses')
                        .update({ stripe_payment_status: 'payment_failed' })
                        .eq('stripe_subscription_id', invoice.subscription);
                }
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        return res.status(200).json({ received: true });

    } catch (err) {
        console.error('Webhook processing error:', err);
        return res.status(500).json({ error: 'Webhook processing failed' });
    }
};

async function sendPaidApprovalEmail(business, businessId) {
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@oldoaktown.co.uk';
    const approveUrl = `${process.env.SITE_URL}/api/approve-business?id=${businessId}&action=approve&token=${process.env.ADMIN_TOKEN}`;
    const rejectUrl = `${process.env.SITE_URL}/api/approve-business?id=${businessId}&action=reject&token=${process.env.ADMIN_TOKEN}`;
    const tierLabel = business.tier === 'premium' ? 'Premium (£75/mo)' : 'Featured (£35/mo)';

    await transporter.sendMail({
        from: `"Old Oak Town" <${ADMIN_EMAIL}>`,
        to: ADMIN_EMAIL,
        subject: `💳 Payment Confirmed - ${business.business_name} [${tierLabel}] - Needs Approval`,
        html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                <div style="background:#2D5016;color:white;padding:20px;text-align:center;">
                    <h1>💳 Payment Confirmed</h1>
                    <p>A paid listing needs your approval</p>
                </div>
                <div style="padding:30px;background:#f9f9f9;">
                    <div style="background:#d4edda;border:1px solid #c3e6cb;padding:15px;border-radius:5px;margin-bottom:20px;">
                        <strong>✅ Payment confirmed:</strong> ${tierLabel}
                    </div>
                    <h2 style="color:#2D5016;">${business.business_name}</h2>
                    <table style="width:100%;border-collapse:collapse;">
                        <tr><td style="padding:8px;border-bottom:1px solid #ddd;"><strong>Category:</strong></td><td style="padding:8px;border-bottom:1px solid #ddd;">${business.category}</td></tr>
                        <tr><td style="padding:8px;border-bottom:1px solid #ddd;"><strong>Email:</strong></td><td style="padding:8px;border-bottom:1px solid #ddd;">${business.email}</td></tr>
                        <tr><td style="padding:8px;border-bottom:1px solid #ddd;"><strong>Address:</strong></td><td style="padding:8px;border-bottom:1px solid #ddd;">${business.address || ''}, ${business.postcode || ''}</td></tr>
                        <tr><td style="padding:8px;"><strong>Description:</strong></td><td style="padding:8px;">${business.description || ''}</td></tr>
                    </table>
                    <div style="margin-top:30px;text-align:center;">
                        <a href="${approveUrl}" style="background:#2D5016;color:white;padding:15px 30px;text-decoration:none;border-radius:5px;margin-right:10px;font-weight:bold;display:inline-block;">✅ APPROVE</a>
                        <a href="${rejectUrl}" style="background:#dc3545;color:white;padding:15px 30px;text-decoration:none;border-radius:5px;font-weight:bold;display:inline-block;">❌ REJECT</a>
                    </div>
                </div>
            </div>
        `
    });
}

async function sendCancellationEmail(business) {
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@oldoaktown.co.uk';
    const SITE_URL = process.env.SITE_URL || 'https://www.oldoaktown.co.uk';
    await transporter.sendMail({
        from: `"Old Oak Town" <${ADMIN_EMAIL}>`,
        to: business.email,
        subject: `Your Old Oak Town subscription has been cancelled - ${business.business_name}`,
        html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                <div style="background:#2D5016;color:white;padding:20px;text-align:center;">
                    <h1>Subscription Cancelled</h1>
                </div>
                <div style="padding:30px;">
                    <p>Your ${business.tier} subscription for <strong>${business.business_name}</strong> has been cancelled.</p>
                    <p style="margin-top:15px;">Your listing will remain as a free listing.</p>
                    <p style="margin-top:15px;">
                        <a href="${SITE_URL}/business-submit.html"
                           style="background:#2D5016;color:white;padding:12px 25px;text-decoration:none;border-radius:5px;display:inline-block;">
                            Resubscribe
                        </a>
                    </p>
                    <hr style="margin:30px 0;border:none;border-top:1px solid #eee;">
                    <p style="color:#999;font-size:0.85rem;">Old Oak Town · ${ADMIN_EMAIL}</p>
                </div>
            </div>
        `
    });
}
