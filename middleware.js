/**
 * Vercel Edge Middleware — HTTP Basic Auth for /admin/*
 *
 * Setup (one-time):
 *   1. Go to Vercel dashboard → Project → Settings → Environment Variables
 *   2. Add:  ADMIN_USER   (e.g. "oldoak")
 *            ADMIN_PASS   (your admin password)
 *   3. Redeploy — the /admin/ path will then require Basic Auth at the CDN edge,
 *      before the page even loads in the browser.
 *
 * If ADMIN_PASS is not set the middleware is a no-op (JS login gate still applies).
 */

export const config = {
    matcher: '/admin/:path*'
};

export default function middleware(request) {
    const validPass = process.env.ADMIN_PASS;

    // If env var isn't configured yet, skip this layer — JS gate still protects the page
    if (!validPass) {
        return;
    }

    const validUser = process.env.ADMIN_USER || 'oldoak';
    const authHeader = request.headers.get('authorization');

    if (authHeader && authHeader.startsWith('Basic ')) {
        try {
            const credentials = atob(authHeader.slice(6));
            const colonIdx = credentials.indexOf(':');
            const user = credentials.slice(0, colonIdx);
            const pass = credentials.slice(colonIdx + 1);

            if (user === validUser && pass === validPass) {
                return; // authenticated — Vercel serves the static file
            }
        } catch {
            // malformed base64 — fall through to 401
        }
    }

    return new Response('Admin access required', {
        status: 401,
        headers: {
            'WWW-Authenticate': 'Basic realm="Old Oak Town Admin"'
        }
    });
}
