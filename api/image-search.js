export const config = { maxDuration: 30 };

const UNSPLASH_ACCESS_KEY  = process.env.UNSPLASH_ACCESS_KEY;
const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY    = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET               = 'oldoaktown';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const q = req.query.q || 'west london regeneration';
    if (!UNSPLASH_ACCESS_KEY) return res.status(500).json({ error: 'UNSPLASH_ACCESS_KEY not configured' });
    try {
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape`;
      const r   = await fetch(url, { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } });
      if (!r.ok) return res.status(502).json({ error: `Unsplash error ${r.status}` });
      const data    = await r.json();
      const results = (data.results || []).map(photo => ({
        id:          photo.id,
        thumb:       photo.urls.small,
        regular:     photo.urls.regular,
        description: photo.alt_description || photo.description || '',
        credit:      photo.user.name,
        creditLink:  photo.user.links.html,
      }));
      return res.status(200).json({ results });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (req.method === 'POST') {
    const { unsplashUrl, filename } = req.body || {};
    if (!unsplashUrl) return res.status(400).json({ error: 'unsplashUrl is required' });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'Supabase env vars not configured' });
    try {
      const imgRes = await fetch(unsplashUrl);
      if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      const buffer      = await imgRes.arrayBuffer();
      const ext    = contentType.includes('png') ? 'png' : 'jpg';
      const date   = new Date().toISOString().split('T')[0];
      const slug   = (filename || `unsplash-${Date.now()}`).replace(/[^a-z0-9-]/gi, '-').toLowerCase().slice(0, 60);
      const path   = `social-images/${date}-${slug}.${ext}`;
      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': contentType, 'x-upsert': 'true' },
        body: buffer,
      });
      if (!uploadRes.ok) { const e = await uploadRes.text(); throw new Error(`Supabase upload failed (${uploadRes.status}): ${e}`); }
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
      return res.status(200).json({ publicUrl, path });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
