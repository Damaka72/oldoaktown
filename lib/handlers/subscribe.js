module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email } = req.body;

        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'A valid email address is required' });
        }

        const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
        const BEEHIIV_PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;

        console.log('API key present:', !!BEEHIIV_API_KEY);
        console.log('Publication ID:', BEEHIIV_PUBLICATION_ID || 'MISSING');

        if (!BEEHIIV_API_KEY || !BEEHIIV_PUBLICATION_ID) {
            console.error('Missing Beehiiv credentials');
            return res.status(500).json({ error: 'Newsletter service not configured' });
        }

        const url = `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUBLICATION_ID}/subscriptions`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${BEEHIIV_API_KEY}`
            },
            body: JSON.stringify({
                email: email,
                reactivate_existing: true,
                send_welcome_email: true,
                utm_source: 'oldoaktown-website',
                utm_medium: 'organic',
                utm_campaign: 'site-signup'
            })
        });

        const data = await response.json();

        console.log('Beehiiv status:', response.status);
        console.log('Beehiiv response:', JSON.stringify(data));

        if (!response.ok) {
            console.error('Beehiiv error:', JSON.stringify(data));
            return res.status(400).json({ error: 'Subscription failed. Please try again.' });
        }

        return res.status(200).json({
            success: true,
            message: "You're subscribed! Your first issue of The Old Oak Weekly will arrive soon."
        });

    } catch (error) {
        console.error('Subscribe error:', error.message);
        return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};
