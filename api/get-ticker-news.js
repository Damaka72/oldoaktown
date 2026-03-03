/**
 * GET /api/get-ticker-news
 *
 * Returns the current news ticker items from data/ticker-news.json.
 * This file is updated daily by the GitHub Actions workflow.
 */

const fs = require('fs');
const path = require('path');

const TICKER_FILE = path.join(__dirname, '../data/ticker-news.json');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!fs.existsSync(TICKER_FILE)) {
      return res.status(404).json({ error: 'Ticker data not found' });
    }

    const raw = fs.readFileSync(TICKER_FILE, 'utf8');
    const data = JSON.parse(raw);

    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(data);
  } catch (err) {
    console.error('Error reading ticker data:', err);
    return res.status(500).json({ error: 'Failed to load ticker data' });
  }
};
