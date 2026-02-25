// Simple Express server for Old Oak Town
// Alternative to Netlify Functions for self-hosting

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ─────────────────────────────────────────────
// BEEHIIV NEWSLETTER SUBSCRIPTION
// ─────────────────────────────────────────────

// Replace your existing app.post('/api/subscribe', ...) block with this.
// Once the bug is fixed, remove the extra console.log lines.
app.post('/api/subscribe', async (req, res) => {
    try {
        const { email, firstName } = req.body;

        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'A valid email address is required' });
        }

        const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
        const BEEHIIV_PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;

        // DEBUG: log what we actually have
        console.log('--- BEEHIIV DEBUG ---');
        console.log('API key present:', !!BEEHIIV_API_KEY);
        console.log('API key prefix:', BEEHIIV_API_KEY ? BEEHIIV_API_KEY.substring(0, 8) : 'MISSING');
        console.log('Publication ID:', BEEHIIV_PUBLICATION_ID || 'MISSING');
        console.log('Email:', email);

        if (!BEEHIIV_API_KEY || !BEEHIIV_PUBLICATION_ID) {
            console.error('Beehiiv credentials not configured');
            return res.status(500).json({ error: 'Newsletter service not configured' });
        }

        const url = `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUBLICATION_ID}/subscriptions`;
        console.log('Calling URL:', url);

        const payload = {
            email,
            reactivate_existing: true,
            send_welcome_email: true,
            utm_source: 'oldoaktown-website',
            utm_medium: 'organic',
            utm_campaign: 'site-signup'
        };

        // Only include first_name if it's actually provided — empty string can cause validation errors
        if (firstName && firstName.trim()) {
            payload.first_name = firstName.trim();
        }

        console.log('Payload:', JSON.stringify(payload));

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${BEEHIIV_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        // DEBUG: log the full Beehiiv response
        console.log('Beehiiv status:', response.status);
        console.log('Beehiiv response:', JSON.stringify(data));
        console.log('--- END DEBUG ---');

        if (!response.ok) {
            return res.status(response.status).json({
                error: 'Failed to subscribe. Please try again.',
                // Temporarily expose Beehiiv's error so we can see it in the browser too
                detail: data
            });
        }

        res.json({
            success: true,
            message: "You're subscribed! Your first issue of The Old Oak Weekly will arrive soon."
        });

    } catch (error) {
        console.error('Subscription error:', error);
        res.status(500).json({
            error: 'Something went wrong. Please try again.',
            detail: error.message
        });
    }
});
