// api/approve-listing.js
// Approve, reject, or suspend a business listing in Supabase
// Also handles admin stats (merged from admin-stats.js)
// POST /api/approve-listing  { submissionId, action, password }
// action: 'approve' (default) | 'reject' | 'suspend'
// POST /api/approve-listing  { action: 'stats', password }  → JSON stats for admin hub

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const FEATURED_PRICE = 35;
const PREMIUM_PRICE  = 75;

module.exports = async function handler(req, res) {
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

    // ── Stats action (for admin hub dashboard) ────────────────────────────────
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

    // ── Listing approve / reject / suspend ────────────────────────────────────
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
};
