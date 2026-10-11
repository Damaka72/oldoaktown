/**
 * Submit router — one serverless function serving the form/submission APIs.
 * Dispatches on ?route=; public URLs are preserved by rewrites in vercel.json
 * (e.g. /api/subscribe -> /api/submit?route=subscribe).
 *
 * To add an endpoint: put the handler in lib/handlers/, register it below,
 * and add a rewrite in vercel.json.
 */
// Loaded lazily so a handler that fails at import time (e.g. missing env var)
// only breaks its own route, not every route on this function.
const handlers = {
  'submit-business': () => require('../lib/handlers/submit-business'),
  'submit-event': () => require('../lib/handlers/submit-event'),
  'subscribe': () => require('../lib/handlers/subscribe'),
};

module.exports = async (req, res) => {
  const route = req.query && req.query.route;
  const load = Object.prototype.hasOwnProperty.call(handlers, route) ? handlers[route] : null;
  if (!load) return res.status(404).json({ error: 'Unknown route' });
  return load()(req, res);
};
