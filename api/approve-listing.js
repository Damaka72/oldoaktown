// api/approve-listing.js
// Approves a pending business listing in Supabase
// POST /api/approve-listing  { submissionId, password }

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { submissionId, password } = req.body;

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

        if (business.status !== 'pending') {
            return res.status(400).json({
                error: 'Can only approve listings with pending status',
                currentStatus: business.status
            });
        }

        const { error: updateError } = await supabase
            .from('businesses')
            .update({ status: 'approved', approved_at: new Date().toISOString() })
            .eq('id', submissionId);

        if (updateError) throw updateError;

        console.log(`Listing approved: ${business.business_name} (${submissionId})`);

        return res.status(200).json({
            success: true,
            message: 'Listing approved successfully',
            businessName: business.business_name
        });

    } catch (err) {
        console.error('approve-listing error:', err);
        return res.status(500).json({ error: 'Failed to approve listing' });
    }
};
