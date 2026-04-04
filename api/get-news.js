/**
 * GET /api/get-news
 *
 * Returns published news articles from data/published/news/*.json,
 * sorted by date descending. Falls back to hardcoded placeholder
 * articles if the directory is empty.
 *
 * Query params:
 *   limit  (integer, default 6)
 *   offset (integer, default 0)
 */

const fs = require('fs');
const path = require('path');

const NEWS_DIR = path.join(__dirname, '../data/published/news');

const FALLBACK_ARTICLES = [
    {
        id: '1',
        title: 'Old Oak Common Station Construction Progresses',
        excerpt: 'Foundation work completed for the UK\'s largest newly built station, with platform installation underway.',
        category: 'HS2 Updates',
        date: '2026-04-01',
        image: 'https://images.unsplash.com/photo-1580757468214-c73f7062a5cb?w=600&h=400&fit=crop',
        imageAlt: 'HS2 Construction',
        body: '<p>Foundation work has been completed for the UK\'s largest newly built station at Old Oak Common, with platform installation now underway.</p><p>HS2 Ltd confirmed that the first platform sections have been installed, marking a significant milestone in the construction programme. The station will have 14 platforms serving HS2 high-speed services, the Elizabeth Line, Great Western Mainline, and Heathrow Express.</p>',
        author: 'Old Oak Town'
    },
    {
        id: '2',
        title: 'First Phase Housing Development Approved',
        excerpt: 'OPDC approves 500 new homes including 50% affordable housing in the Old Oak Mile development.',
        category: 'Housing',
        date: '2026-03-30',
        image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop',
        imageAlt: 'New Housing',
        body: '<p>The Old Oak and Park Royal Development Corporation (OPDC) has approved the first phase of housing in the Old Oak Mile development, comprising 500 new homes with 50% designated as affordable housing.</p><p>Construction is expected to begin in 2026 with first residents moving in by 2028.</p>',
        author: 'Old Oak Town'
    },
    {
        id: '3',
        title: 'Local Business Forum Launches',
        excerpt: 'New initiative connects existing Park Royal businesses with incoming developments and opportunities.',
        category: 'Community',
        date: '2026-03-27',
        image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=400&fit=crop',
        imageAlt: 'Community',
        body: '<p>A new initiative connecting existing Park Royal businesses with incoming developments and opportunities has launched, bringing together over 200 local employers for the first time.</p>',
        author: 'Old Oak Town'
    },
    {
        id: '4',
        title: 'New Bus Routes Connect Old Oak to Central London',
        excerpt: 'Transport for London announces enhanced bus services ahead of station opening, improving local connectivity.',
        category: 'Transport',
        date: '2026-03-20',
        image: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=600&h=400&fit=crop',
        imageAlt: 'Transport',
        body: '<p>Transport for London has announced enhanced bus services connecting Old Oak Common to Central London ahead of the station opening, significantly improving connectivity for existing residents.</p>',
        author: 'Old Oak Town'
    },
    {
        id: '5',
        title: 'Affordable Housing Initiative Reaches Milestone',
        excerpt: 'OPDC confirms commitment to deliver 50% affordable homes across all new developments in the area.',
        category: 'Housing',
        date: '2026-03-13',
        image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=400&fit=crop',
        imageAlt: 'Affordable Housing',
        body: '<p>OPDC has reconfirmed its commitment to delivering 50% affordable homes across all new developments in the area, a target that puts Old Oak Common ahead of most major London regeneration schemes.</p>',
        author: 'Old Oak Town'
    },
    {
        id: '6',
        title: 'Job Centre Opens to Support Local Employment',
        excerpt: 'New dedicated employment hub launched to connect residents with thousands of upcoming job opportunities.',
        category: 'Employment',
        date: '2026-03-04',
        image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=600&h=400&fit=crop',
        imageAlt: 'Jobs',
        body: '<p>A new dedicated employment hub has launched in the Old Oak area to connect local residents with the thousands of job opportunities expected from the regeneration project over the coming decade.</p>',
        author: 'Old Oak Town'
    }
];

module.exports = (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 6, 20);
    const offset = parseInt(req.query.offset) || 0;

    try {
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5-minute cache
        res.setHeader('Content-Type', 'application/json');

        if (!fs.existsSync(NEWS_DIR)) {
            return res.status(200).json({ articles: FALLBACK_ARTICLES.slice(offset, offset + limit), total: FALLBACK_ARTICLES.length, source: 'fallback' });
        }

        const files = fs.readdirSync(NEWS_DIR).filter(f => f.endsWith('.json'));

        if (files.length === 0) {
            return res.status(200).json({ articles: FALLBACK_ARTICLES.slice(offset, offset + limit), total: FALLBACK_ARTICLES.length, source: 'fallback' });
        }

        const articles = files
            .map(file => {
                try {
                    return JSON.parse(fs.readFileSync(path.join(NEWS_DIR, file), 'utf8'));
                } catch (e) {
                    return null;
                }
            })
            .filter(Boolean)
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        return res.status(200).json({
            articles: articles.slice(offset, offset + limit),
            total: articles.length,
            source: 'published'
        });

    } catch (err) {
        console.error('Error reading news:', err);
        return res.status(200).json({ articles: FALLBACK_ARTICLES.slice(offset, offset + limit), total: FALLBACK_ARTICLES.length, source: 'fallback' });
    }
};
