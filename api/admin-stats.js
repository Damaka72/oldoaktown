// api/admin-stats.js
// Lightweight stats endpoint for the unified admin hub
// POST /api/admin-stats  { password }
// Returns JSON with business counts, revenue estimate, and video count

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
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { password } = req.body || {};
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword || password !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

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

        const pending   = (businesses || []).filter(b => b.status === 'pending').length;
        const approved  = (businesses || []).filter(b => b.status === 'approved').length;
        const featured  = (businesses || []).filter(b => b.status === 'approved' && b.tier === 'featured').length;
        const premium   = (businesses || []).filter(b => b.status === 'approved' && b.tier === 'premium').length;
        const videosLive = vidErr ? 0 : (videos || []).length;

        const monthlyRevenue = (featured * FEATURED_PRICE) + (premium * PREMIUM_PRICE);

        return res.status(200).json({
            pendingBusinesses: pending,
            approvedBusinesses: approved,
            featuredBusinesses: featured,
            premiumBusinesses: premium,
            videosLive,
            monthlyRevenue,
            reviewQueue: 0  // file-based queue; placeholder for future API
        });

    } catch (err) {
        console.error('admin-stats error:', err);
        return res.status(500).json({ error: 'Failed to fetch stats' });
    }
};
