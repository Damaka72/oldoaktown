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
// IMPORTANT: the INSTAGRAM_ACCESS_TOKEN env var in Vercel must be of type
// "Encrypted" (the default), not "Sensitive". Sensitive vars are write-only
// and cannot be read back, so the refresh chain can't work with them.

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

  // 1. Find the INSTAGRAM_ACCESS_TOKEN env var and its id.
  const list = await vercel(`/v9/projects/${projectId}/env?${q}`);
  const entry = (list.envs || []).find((e) => e.key === 'INSTAGRAM_ACCESS_TOKEN');
  if (!entry) {
    console.error('::error::INSTAGRAM_ACCESS_TOKEN not found in the Vercel project.');
    process.exit(1);
  }

  // 2. Read the current (decrypted) token value.
  const single = await vercel(`/v1/projects/${projectId}/env/${entry.id}?${q}`);
  const current = single && single.value;
  if (!current) {
    console.error(
      '::error::Could not read the current token value. Make sure the ' +
      'INSTAGRAM_ACCESS_TOKEN env var is type "Encrypted", not "Sensitive".'
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
    console.log(`Instagram returned the same token (validity extended, ~${days} days). Nothing to update.`);
    return;
  }

  // 4. Write the new token back to Vercel.
  await vercel(`/v9/projects/${projectId}/env/${entry.id}?${q}`, {
    method: 'PATCH',
    body: JSON.stringify({ value: newToken }),
  });
  console.log(`Updated Vercel INSTAGRAM_ACCESS_TOKEN — new token valid ~${days} days.`);

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
