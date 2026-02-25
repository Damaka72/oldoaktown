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
        const { category, area, search, tier } = req.query;

        let query = supabase
            .from('businesses')
            .select(`
                id, business_name, category, phone, address, postcode,
                description, website, logo_url, image_urls,
                instagram, twitter, linkedin, opening_hours,
                special_offers, tier, view_count
            `)
            .eq('status', 'approved')
            .order('tier', { ascending: false }) // premium first, then featured, then free
            .order('business_name', { ascending: true });

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

        const { data, error } = await query;

        if (error) {
            console.error('Supabase query error:', error);
            return res.status(500).json({ error: 'Failed to fetch businesses' });
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
            total: data?.length || 0,
            businesses: data || [],
            grouped
        });

    } catch (err) {
        console.error('Get businesses error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
