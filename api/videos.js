// api/videos.js
// Unified video endpoint — public reads, admin writes
// GET    /api/videos               → return all active videos ordered for display
// POST   /api/videos  { password, title, description, url, tags, display_order }  → add video
// DELETE /api/videos  { password, id }  → delete video

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// ─── URL Parsing ──────────────────────────────────────────────────────────────

function parseVideoUrl(rawUrl) {
    const url = rawUrl.trim();

    // YouTube — handles watch, youtu.be, embed, shorts, mobile
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (ytMatch) {
        return { platform: 'youtube', embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}` };
    }

    // Vimeo — handles vimeo.com, player.vimeo.com, channels
    const vmMatch = url.match(/(?:vimeo\.com\/(?:video\/|channels\/[^/]+\/)?|player\.vimeo\.com\/video\/)(\d+)/);
    if (vmMatch) {
        return { platform: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vmMatch[1]}` };
    }

    // Other — accept any https:// URL as-is (admin's responsibility)
    if (url.startsWith('https://')) {
        return { platform: 'other', embedUrl: url };
    }

    throw new Error('Could not recognise this video URL. Please use a YouTube or Vimeo link, or a full https:// embed URL.');
}

// ─── Handler ─────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
    // GET — public, no auth required
    if (req.method === 'GET') {
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
            console.error('videos GET error:', err);
            return res.status(500).json({ error: 'Failed to load videos' });
        }
    }

    // POST / DELETE — admin auth required
    const body = req.body || {};
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || body.password !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // POST — Add a new video
    if (req.method === 'POST') {
        const { title, description, url, tags, display_order } = body;

        if (!title || !url) {
            return res.status(400).json({ error: 'Title and URL are required' });
        }

        let parsed;
        try {
            parsed = parseVideoUrl(url);
        } catch (parseErr) {
            return res.status(400).json({ error: parseErr.message });
        }

        try {
            const { data, error } = await supabase
                .from('videos')
                .insert([{
                    title:         title.trim(),
                    description:   description ? description.trim() : null,
                    platform:      parsed.platform,
                    embed_url:     parsed.embedUrl,
                    tags:          tags ? tags.trim() : null,
                    display_order: display_order !== undefined ? parseInt(display_order, 10) : 0,
                    active:        true
                }])
                .select()
                .single();

            if (error) throw error;

            console.log('Video added:', data.title, '(', data.id, ')');
            return res.status(200).json({ success: true, video: data });
        } catch (err) {
            console.error('videos POST error:', err);
            return res.status(500).json({ error: 'Failed to save video' });
        }
    }

    // DELETE — Remove a video
    if (req.method === 'DELETE') {
        const { id } = body;

        if (!id) {
            return res.status(400).json({ error: 'Missing video id' });
        }

        try {
            const { error } = await supabase
                .from('videos')
                .delete()
                .eq('id', id);

            if (error) throw error;

            console.log('Video deleted:', id);
            return res.status(200).json({ success: true });
        } catch (err) {
            console.error('videos DELETE error:', err);
            return res.status(500).json({ error: 'Failed to delete video' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed. Use GET to list, POST to add, or DELETE to remove.' });
};
