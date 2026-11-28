// api/get-businesses.js
// Returns all approved businesses for the directory page
// Groups by category, featured/premium at top

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY // public read-only key
);

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { category, area, search, tier, sort, limit } = req.query;

        let query = supabase
            .from('businesses')
            .select(`
                id, business_name, category, phone, address, postcode,
                description, website, logo_url, image_urls,
                instagram, twitter, linkedin, opening_hours,
                special_offers, tier, view_count, approved_at
            `, { count: 'exact' })
            .eq('status', 'approved');

        // ?sort=new → most recently approved first (homepage "What's new");
        // default → premium first, then featured, then free.
        if (sort === 'new') {
            query = query.order('approved_at', { ascending: false, nullsFirst: false });
        } else {
            query = query
                .order('tier', { ascending: false })
                .order('business_name', { ascending: true });
        }

        const limitN = parseInt(limit, 10);
        if (limitN > 0) query = query.limit(Math.min(limitN, 200));

        // Optional filters
        if (category && category !== 'all') {
            query = query.eq('category', category);
        }

        if (tier) {
            query = query.eq('tier', tier);
        }

        if (search) {
            query = query.or(`business_name.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%`);
        }

        if (area && area !== 'all') {
            // Filter by postcode prefix or area name
            const areaFilters = {
                'park-royal': 'NW10',
                'harlesden': 'NW10',
                'north-acton': 'W3',
                'kensal-green': 'NW10',
                'willesden': 'NW10',
                'east-acton': 'W3'
            };
            const postcodePrefix = areaFilters[area];
            if (postcodePrefix) {
                query = query.ilike('postcode', `${postcodePrefix}%`);
            }
        }

        const { data, error, count } = await query;

        if (error) {
            console.error('Supabase query error:', error);
            return res.status(500).json({
                error: 'Failed to fetch businesses',
                detail: error.message,
                code: error.code
            });
        }

        // Group by category for easier rendering
        const grouped = {};
        (data || []).forEach(business => {
            const cat = business.category || 'other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(business);
        });

        return res.status(200).json({
            success: true,
            total: count ?? data?.length ?? 0,
            businesses: data || [],
            grouped
        });

    } catch (err) {
        console.error('Get businesses error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
