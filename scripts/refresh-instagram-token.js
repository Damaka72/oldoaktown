// scripts/refresh-instagram-token.js
//
// Keeps the homepage Instagram feed alive without manual work.
//
// Instagram's long-lived access tokens (Instagram API with Instagram Login)
// expire after ~60 days. This script refreshes the token and writes the new
// value straight back into the Vercel project's INSTAGRAM_ACCESS_TOKEN env
// var, then (optionally) triggers a redeploy so the live functions pick it up.
// Run monthly by .github/workflows/refresh-instagram-token.yml, so the token
// is always refreshed well inside its 60-day window.
//
// Vercel is the single source of truth for the token — the script reads the
// current value from Vercel, refreshes it, and writes the new value back to
// the same place. Nothing else needs to be kept in sync.
//
// Required env vars (set as GitHub Actions secrets / workflow env):
//   VERCEL_TOKEN            Vercel API token (Account Settings → Tokens)
//   VERCEL_PROJECT_ID       Vercel project id (prj_...)
//   VERCEL_TEAM_ID          Vercel team id   (team_...)
// Optional:
//   VERCEL_DEPLOY_HOOK_URL  Vercel deploy hook — POSTed to trigger a redeploy
//                           so functions load the new token immediately.
//
// WHY EDGE CONFIG: Vercel now stores every new env var as Sensitive
// (write-only), so the current token can't be read back from env vars. The
// refresh chain therefore lives in a Vercel Edge Config store (item
// "instagram_token"), which this job can read and write with VERCEL_TOKEN.
// After each refresh the new token is also written to INSTAGRAM_ACCESS_TOKEN
// (write-only is fine there — the site only needs to read it at runtime).
//
// Extra env vars:
//   EDGE_CONFIG_ID          id of the Edge Config store (ecfg_...)
//   INSTAGRAM_TOKEN_SEED    one-off: a freshly generated token used only when
//                           the store has no token yet. Remove after first run.

const API = 'https://api.vercel.com';

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`::error::Missing required env var ${name}`);
    process.exit(1);
  }
  return v;
}

async function vercel(path, options = {}) {
  const token = process.env.VERCEL_TOKEN;
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!res.ok) {
    throw new Error(`Vercel API ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

async function main() {
  const projectId = required('VERCEL_PROJECT_ID');
  const teamId = required('VERCEL_TEAM_ID');
  required('VERCEL_TOKEN');
  const q = `teamId=${encodeURIComponent(teamId)}`;

  const edgeId = required('EDGE_CONFIG_ID');
  const ITEM_KEY = 'instagram_token';

  // 1. Live env var entries (written to after the refresh; never read).
  const list = await vercel(`/v9/projects/${projectId}/env?${q}`);
  const liveEntries = (list.envs || []).filter((e) => e.key === 'INSTAGRAM_ACCESS_TOKEN');
  if (!liveEntries.length) {
    console.error('::error::INSTAGRAM_ACCESS_TOKEN not found in the Vercel project.');
    process.exit(1);
  }

  // 2. Current token: from Edge Config, or the one-off seed on first run.
  let current = null;
  try {
    const item = await vercel(`/v1/edge-config/${edgeId}/item/${ITEM_KEY}?${q}`);
    current = item && item.value;
  } catch (err) {
    console.log(`Edge Config has no ${ITEM_KEY} yet (${err.message.slice(0, 80)}).`);
  }
  if (!current && process.env.INSTAGRAM_TOKEN_SEED) {
    current = process.env.INSTAGRAM_TOKEN_SEED.trim();
    console.log('Using INSTAGRAM_TOKEN_SEED to start the refresh chain.');
  }
  if (!current) {
    console.error(
      '::error::No token to refresh. Add a freshly generated Instagram token as the ' +
      'GitHub secret INSTAGRAM_TOKEN_SEED and re-run.'
    );
    process.exit(1);
  }

  // 3. Ask Instagram for a fresh long-lived token.
  const refreshUrl =
    'https://graph.instagram.com/refresh_access_token' +
    `?grant_type=ig_refresh_token&access_token=${encodeURIComponent(current)}`;
  const igRes = await fetch(refreshUrl);
  const igRaw = await igRes.text();
  let igJson;
  try { igJson = JSON.parse(igRaw); } catch { igJson = null; }
  if (!igRes.ok || !igJson || !igJson.access_token) {
    const detail = (igJson && igJson.error && igJson.error.message) || igRaw.slice(0, 300);
    console.error(`::error::Instagram token refresh failed: ${detail}`);
    process.exit(1);
  }
  const newToken = igJson.access_token;
  const days = igJson.expires_in ? Math.round(igJson.expires_in / 86400) : '?';

  if (newToken === current) {
    console.log(`Instagram returned the same token (validity extended, ~${days} days).`);
    await vercel(`/v1/edge-config/${edgeId}/items?${q}`, {
      method: 'PATCH',
      body: JSON.stringify({ items: [{ operation: 'upsert', key: ITEM_KEY, value: newToken }] }),
    });
    return;
  }

  // 4. Store the new token for the next refresh, then update the live env var.
  await vercel(`/v1/edge-config/${edgeId}/items?${q}`, {
    method: 'PATCH',
    body: JSON.stringify({ items: [{ operation: 'upsert', key: ITEM_KEY, value: newToken }] }),
  });
  for (const entry of liveEntries) {
    await vercel(`/v9/projects/${projectId}/env/${entry.id}?${q}`, {
      method: 'PATCH',
      body: JSON.stringify({ value: newToken }),
    });
  }
  console.log(`Token refreshed — valid ~${days} days. Updated Edge Config and ${liveEntries.length} env var(s).`);

  // 5. Trigger a redeploy so live functions pick up the new value.
  const hook = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (hook) {
    const dep = await fetch(hook, { method: 'POST' });
    if (dep.ok) {
      console.log('Triggered a Vercel redeploy via deploy hook.');
    } else {
      console.log(`::warning::Deploy hook returned HTTP ${dep.status}. New token applies on next deploy.`);
    }
  } else {
    console.log('No VERCEL_DEPLOY_HOOK_URL set — new token applies on the next deploy.');
  }
}

main().catch((err) => {
  console.error(`::error::${err.message}`);
  process.exit(1);
});
