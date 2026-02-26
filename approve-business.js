// api/approve-business.js
// Called when admin clicks Approve or Reject link in email
// Updates status in Supabase and notifies the business owner

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

module.exports = async (req, res) => {
    const { id, action, token } = req.query;

    // Verify admin token to prevent unauthorised approvals
    // Explicit check that ADMIN_TOKEN is set — if it's undefined, every request
    // would satisfy `undefined !== undefined === false` and bypass auth entirely
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
        // Get the business record
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
            // Update status to approved
            const { error: updateError } = await supabase
                .from('businesses')
                .update({
                    status: 'approved',
                    approved_at: new Date().toISOString()
                })
                .eq('id', id);

            if (updateError) throw updateError;

            // Notify business owner — wrapped so an email failure doesn't
            // return 500 after the Supabase update already committed
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
            // Reject - update status
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
};

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
