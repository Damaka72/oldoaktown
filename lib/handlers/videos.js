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
    // Instagram feed lives here too (kept as one function to stay under the
    // Vercel Hobby function limit). /api/instagram-feed rewrites to
    // /api/videos?ig=1 — see vercel.json. Real posts when a token is set,
    // graceful empty list otherwise so the homepage keeps its fallback grid.
    if (req.method === 'GET' && req.query && req.query.ig) {
        return handleInstagram(req, res);
    }

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

// ─── Instagram feed (served at /api/instagram-feed via rewrite) ──────────────
// Latest @oldoaktown posts via the official Instagram API with Instagram Login
// (graph.instagram.com/me/media). The old Basic Display API was retired by
// Meta in Dec 2024. Requires env var INSTAGRAM_ACCESS_TOKEN (long-lived,
// ~60-day life — refresh via graph.instagram.com/refresh_access_token).
// Never hard-fails: missing token or an API error returns an empty list so
// the homepage keeps its static fallback grid.

const IG_GRAPH_BASE = 'https://graph.instagram.com';
const IG_FIELDS = [
    'id',
    'caption',
    'media_type',
    'media_url',
    'permalink',
    'thumbnail_url',
    'timestamp',
    'children{media_url,thumbnail_url,media_type}',
].join(',');

const IG_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let igCache = { at: 0, posts: null };

function igImageForPost(item) {
    if (item.media_type === 'VIDEO') {
        return item.thumbnail_url || item.media_url || null;
    }
    if (item.media_type === 'CAROUSEL_ALBUM') {
        const first = item.children && item.children.data && item.children.data[0];
        if (first) {
            return first.media_type === 'VIDEO'
                ? first.thumbnail_url || first.media_url || null
                : first.media_url || first.thumbnail_url || null;
        }
        return item.media_url || item.thumbnail_url || null;
    }
    return item.media_url || item.thumbnail_url || null;
}

function igShortCaption(caption) {
    if (!caption) return '';
    const firstLine = caption.split('\n')[0].trim();
    const clean = firstLine.replace(/\s+/g, ' ');
    return clean.length > 90 ? clean.slice(0, 87).trimEnd() + '…' : clean;
}

async function handleInstagram(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const limit = Math.min(parseInt(req.query.limit, 10) || 6, 12);
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;

    if (!token) {
        return res.status(200).json({
            success: false,
            configured: false,
            posts: [],
            hint: 'Set INSTAGRAM_ACCESS_TOKEN in env vars to enable the live feed.',
        });
    }

    if (igCache.posts && Date.now() - igCache.at < IG_CACHE_TTL_MS) {
        return res.status(200).json({ success: true, cached: true, posts: igCache.posts.slice(0, limit) });
    }

    try {
        const url =
            `${IG_GRAPH_BASE}/me/media?fields=${encodeURIComponent(IG_FIELDS)}` +
            `&limit=${limit}&access_token=${encodeURIComponent(token)}`;

        const igRes = await fetch(url);
        const raw = await igRes.text();
        let data;
        try {
            data = JSON.parse(raw);
        } catch {
            data = null;
        }

        if (!igRes.ok || !data || data.error) {
            const detail = data?.error?.message || raw.slice(0, 200);
            console.error('Instagram feed error:', igRes.status, detail);
            if (igCache.posts) {
                return res.status(200).json({ success: true, stale: true, posts: igCache.posts.slice(0, limit) });
            }
            return res.status(200).json({ success: false, posts: [], error: detail });
        }

        const posts = (data.data || [])
            .map((item) => {
                const image = igImageForPost(item);
                if (!image) return null;
                return {
                    id: item.id,
                    image,
                    permalink: item.permalink,
                    caption: igShortCaption(item.caption),
                    mediaType: item.media_type,
                    timestamp: item.timestamp,
                };
            })
            .filter(Boolean);

        igCache = { at: Date.now(), posts };

        return res.status(200).json({ success: true, posts: posts.slice(0, limit) });
    } catch (err) {
        console.error('Instagram feed exception:', err);
        if (igCache.posts) {
            return res.status(200).json({ success: true, stale: true, posts: igCache.posts.slice(0, limit) });
        }
        return res.status(200).json({ success: false, posts: [], error: err.message });
    }
}
