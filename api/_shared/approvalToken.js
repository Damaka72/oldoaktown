// api/_shared/approvalToken.js
// Signs and verifies the tokens used in business approve/reject email links.
//
// Previously these links carried the raw ADMIN_TOKEN secret in the query
// string (?token=...), which meant that one long-lived, all-powerful secret
// sat in plaintext in browser history, server/proxy access logs and any
// referrer headers for as long as the link existed. Anyone who obtained one
// link could use that same token to approve or reject ANY business, forever.
//
// Instead we HMAC-sign the specific (id, action) pair with ADMIN_TOKEN as
// the signing key and an embedded expiry. The secret itself never appears
// in the URL, a leaked link only works for that one business and that one
// action, and it stops working once it expires.
const crypto = require('crypto');

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sign(id, action, ttlMs = DEFAULT_TTL_MS) {
    const secret = process.env.ADMIN_TOKEN;
    if (!secret) throw new Error('ADMIN_TOKEN not configured');

    const expires = Date.now() + ttlMs;
    const hmac = crypto.createHmac('sha256', secret).update(`${id}:${action}:${expires}`).digest('hex');
    return Buffer.from(`${expires}.${hmac}`).toString('base64url');
}

function verify(id, action, token) {
    const secret = process.env.ADMIN_TOKEN;
    if (!secret || !id || !action || !token) return false;

    let decoded;
    try {
        decoded = Buffer.from(String(token), 'base64url').toString('utf8');
    } catch {
        return false;
    }

    const sep = decoded.indexOf('.');
    if (sep === -1) return false;

    const expires = Number(decoded.slice(0, sep));
    const givenHmac = decoded.slice(sep + 1);
    if (!Number.isFinite(expires) || Date.now() > expires) return false;

    const expectedHmac = crypto.createHmac('sha256', secret).update(`${id}:${action}:${expires}`).digest('hex');

    const a = Buffer.from(givenHmac, 'hex');
    const b = Buffer.from(expectedHmac, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

module.exports = { sign, verify };
