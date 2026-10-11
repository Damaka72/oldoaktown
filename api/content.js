/**
 * Content router — one serverless function serving the read-only content APIs.
 * Vercel Hobby allows 12 functions, so related endpoints share a function and
 * are dispatched on ?route=. Public URLs are preserved by rewrites in vercel.json
 * (e.g. /api/get-businesses -> /api/content?route=get-businesses).
 *
 * To add an endpoint: put the handler in lib/handlers/, register it below,
 * and add a rewrite in vercel.json.
 */
// Loaded lazily so a handler that fails at import time (e.g. missing env var)
// only breaks its own route, not every route on this function.
const handlers = {
  'get-businesses': () => require('../lib/handlers/get-businesses'),
  'get-ticker-news': () => require('../lib/handlers/get-ticker-news'),
  'image-search': () => require('../lib/handlers/image-search'),
  'agent-data': () => require('../lib/handlers/agent-data'),
  'videos': () => require('../lib/handlers/videos'),
};

module.exports = async (req, res) => {
  const route = req.query && req.query.route;
  const load = Object.prototype.hasOwnProperty.call(handlers, route) ? handlers[route] : null;
  if (!load) return res.status(404).json({ error: 'Unknown route' });
  return load()(req, res);
};
