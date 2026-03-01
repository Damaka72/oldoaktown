// api/get-videos.js
// Public GET endpoint — returns all active videos ordered for display
// GET /api/get-videos
// Returns: { videos: [...] }

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { data, error } = await supabase
            .from('videos')
            .select('id, title, description, platform, embed_url, tags, display_order, created_at')
            .eq('active', true)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) throw error;

        return res.status(200).json({ videos: data || [] });

    } catch (err) {
        console.error('get-videos error:', err);
        return res.status(500).json({ error: 'Failed to load videos' });
    }
};
