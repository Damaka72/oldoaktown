// api/approve-event.js
// Admin-only management for the Supabase `events` table.
// Password-protected (ADMIN_PASSWORD). Uses the service key so it can read
// pending events (which the public anon key cannot) and update their status.
//
// POST /api/approve-event  { action: 'list', password }
//   → { events: [...] }  every event, newest first
// POST /api/approve-event  { eventId, action, password }
//   action: 'approve' | 'reject' | 'suspend' | 'delete'
// POST /api/approve-event  { action: 'create', password, event: {...} }
//   → admin adds an event directly as 'approved'

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const VALID_CATEGORIES = ['hs2', 'planning', 'housing', 'community', 'business', 'investment', 'other'];

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { eventId, action = 'approve', password, event } = req.body || {};

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || password !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // ── List every event (admin needs pending + rejected too) ──────────────
        if (action === 'list') {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .order('event_date', { ascending: true });
            if (error) throw error;
            return res.status(200).json({ success: true, events: data || [] });
        }

        // ── Admin creates an event directly (goes live immediately) ────────────
        if (action === 'create') {
            const e = event || {};
            if (!e.title || !e.eventDate) {
                return res.status(400).json({ error: 'Event title and date are required' });
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(e.eventDate)) {
                return res.status(400).json({ error: 'Event date must be in YYYY-MM-DD format' });
            }
            const cat = VALID_CATEGORIES.includes(e.category) ? e.category : 'community';
            const { data, error } = await supabase
                .from('events')
                .insert([{
                    title: e.title,
                    description: e.description || null,
                    category: cat,
                    event_date: e.eventDate,
                    start_time: e.startTime || null,
                    end_time: e.endTime || null,
                    location: e.location || null,
                    postcode: e.postcode || null,
                    organiser_name: e.organiserName || null,
                    source: 'manual',
                    source_url: e.sourceUrl || null,
                    status: 'approved',
                    approved_at: new Date().toISOString(),
                    approved_by: 'admin'
                }])
                .select()
                .single();
            if (error) throw error;
            return res.status(200).json({ success: true, event: data });
        }

        // ── Approve / reject / suspend / delete an existing event ──────────────
        if (!eventId) {
            return res.status(400).json({ error: 'Missing eventId' });
        }

        if (action === 'delete') {
            const { error } = await supabase.from('events').delete().eq('id', eventId);
            if (error) throw error;
            return res.status(200).json({ success: true, message: 'Event deleted' });
        }

        const updates = {};
        if (action === 'approve') {
            updates.status = 'approved';
            updates.approved_at = new Date().toISOString();
            updates.approved_by = 'admin';
        } else if (action === 'reject') {
            updates.status = 'rejected';
        } else if (action === 'suspend') {
            updates.status = 'pending';
        } else {
            return res.status(400).json({ error: 'Invalid action. Use list, create, approve, reject, suspend, or delete.' });
        }

        const { data, error } = await supabase
            .from('events')
            .update(updates)
            .eq('id', eventId)
            .select()
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Event not found' });

        console.log(`Event ${action}d: ${data.title} (${eventId})`);
        return res.status(200).json({ success: true, message: `Event ${action}d successfully`, title: data.title });

    } catch (err) {
        console.error('approve-event error:', err);
        return res.status(500).json({ error: 'Failed to update event', detail: err.message });
    }
};
