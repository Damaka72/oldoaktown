// api/approve-listing.js
// Approve, reject, or suspend a business listing in Supabase
// POST /api/approve-listing  { submissionId, action, password }
// action: 'approve' (default) | 'reject' | 'suspend'

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { submissionId, action = 'approve', password } = req.body;

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || password !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized' });
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
            return res.status(400).json({ error: 'Invalid action. Use approve, reject, or suspend.' });
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
};
