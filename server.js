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

app.post('/api/subscribe', async (req, res) => {
    try {
        const { email, firstName } = req.body;

        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'A valid email address is required' });
        }

        const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
        const BEEHIIV_PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;

        if (!BEEHIIV_API_KEY || !BEEHIIV_PUBLICATION_ID) {
            console.error('Beehiiv credentials not configured');
            return res.status(500).json({ error: 'Newsletter service not configured' });
        }

        const url = `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUBLICATION_ID}/subscriptions`;

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

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${BEEHIIV_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const data = await response.json();
            console.error('Beehiiv subscription error:', response.status, data);
            return res.status(502).json({ error: 'Failed to subscribe. Please try again.' });
        }

        res.json({
            success: true,
            message: "You're subscribed! Your first issue of The Old Oak Weekly will arrive soon."
        });

    } catch (error) {
        console.error('Subscription error:', error);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// ─────────────────────────────────────────────
// BUSINESS DIRECTORY
// ─────────────────────────────────────────────

const submitBusiness = require('./api/submit-business');
const approveBusiness = require('./approve-business');
const getBusinesses = require('./get-businesses');
const stripeWebhook = require('./api/stripe-webhook');

app.post('/api/submit-business', submitBusiness);
app.get('/api/approve-business', approveBusiness);
app.get('/api/get-businesses', getBusinesses);
app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), stripeWebhook);

app.listen(PORT, () => {
    console.log(`Old Oak Town server running on port ${PORT}`);
});
