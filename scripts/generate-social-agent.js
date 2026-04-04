#!/usr/bin/env node
/**
 * generate-social-agent.js
 *
 * Generates a branded social-agent.html for any site by substituting
 * site-specific values into the oldoaktown master template.
 *
 * Usage:
 *   node scripts/generate-social-agent.js --config scripts/sites/mysite.json
 *   node scripts/generate-social-agent.js --config scripts/sites/mysite.json --output ../mysite/social-agent.html
 *
 * Config file format: see scripts/sites/example.json
 */

const fs   = require('fs');
const path = require('path');

// ── CLI ──────────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const getArg  = flag => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const configPath = getArg('--config');
const outputPath = getArg('--output') || 'social-agent.html';

if (!configPath) {
  console.error('Usage: node scripts/generate-social-agent.js --config <path/to/config.json> [--output <path>]');
  console.error('');
  console.error('Example configs are in scripts/sites/');
  process.exit(1);
}

// ── Load config ──────────────────────────────────────────────────────────────
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.error(`Cannot read config: ${configPath}\n${e.message}`);
  process.exit(1);
}

// Required fields
for (const field of ['siteName', 'siteSlug']) {
  if (!config[field]) { console.error(`Config missing required field: ${field}`); process.exit(1); }
}

// ── Load template ────────────────────────────────────────────────────────────
const templatePath = path.join(__dirname, '..', 'social-agent.html');
if (!fs.existsSync(templatePath)) {
  console.error(`Template not found: ${templatePath}`);
  process.exit(1);
}
let html = fs.readFileSync(templatePath, 'utf8');

// ── 1. Page title ────────────────────────────────────────────────────────────
html = html.replace(
  '<title>Old Oak Town — Social Command Centre</title>',
  `<title>${config.siteName} — Social Command Centre</title>`
);

// ── 2. Google Fonts ──────────────────────────────────────────────────────────
if (config.fonts?.googleFontsUrl) {
  html = html.replace(
    /@import url\('https:\/\/fonts\.googleapis\.com\/css2[^']+'\);/,
    `@import url('${config.fonts.googleFontsUrl}');`
  );
}

// ── 3. CSS colour variables ───────────────────────────────────────────────────
if (config.colors) {
  const c = config.colors;

  // Map old variable names → new values
  const valueMap = {
    '--green-deep':   c.primary    ?? '#1C3A0E',
    '--green-mid':    c.primaryMid ?? '#2F6020',
    '--green-bright': c.accent     ?? '#4C8A35',
    '--green-pale':   c.accentPale ?? '#D4E8C8',
    '--green-ghost':  c.ghost      ?? '#F0F7EB',
    '--border':       c.border     ?? '#DDE8D4',
    '--muted':        c.muted      ?? '#6B7B5E',
    '--ink':          c.ink        ?? '#0F1A0A',
    '--cream':        c.cream      ?? '#FAF8F4',
  };

  // Replace the values in :root declarations
  for (const [varName, newValue] of Object.entries(valueMap)) {
    // Matches:  --green-deep: #1C3A0E;
    const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`(${escaped}:\\s*)[^;]+;`), `$1${newValue};`);
  }

  // Rename --green-* variable names throughout (declarations + usages)
  const renameMap = [
    ['--green-deep',   '--primary'],
    ['--green-mid',    '--primary-mid'],
    ['--green-bright', '--accent'],
    ['--green-pale',   '--accent-pale'],
    ['--green-ghost',  '--ghost'],
  ];
  for (const [from, to] of renameMap) {
    html = html.split(from).join(to);
  }

  // Update hardcoded hex values in the login screen inline styles
  if (c.primary) {
    html = html.split('background:#1C3A0E').join(`background:${c.primary}`);
    html = html.split('color:#1C3A0E').join(`color:${c.primary}`);
    html = html.split(`background: var(--green-deep)`).join(`background: var(--primary)`);
  }
}

// ── 4. Font family references ─────────────────────────────────────────────────
if (config.fonts?.heading && config.fonts.heading !== 'Instrument Serif') {
  html = html.split("'Instrument Serif'").join(`'${config.fonts.heading}'`);
}
if (config.fonts?.body && config.fonts.body !== 'DM Sans') {
  html = html.split("'DM Sans'").join(`'${config.fonts.body}'`);
}

// ── 5. Brand icon letter ─────────────────────────────────────────────────────
const iconLetter = config.iconLetter || config.siteName.charAt(0);
html = html.replace(
  '<div class="brand-icon">O</div>',
  `<div class="brand-icon">${iconLetter}</div>`
);

// ── 6. Brand name ─────────────────────────────────────────────────────────────
html = html.replace(
  '<div class="brand-name">Old Oak Town</div>',
  `<div class="brand-name">${config.siteName}</div>`
);

// ── 7. Login screen logo alt text ─────────────────────────────────────────────
html = html.replace('alt="Old Oak Town"', `alt="${config.siteName}"`);

// ── 8. Session / history localStorage keys ───────────────────────────────────
html = html.replace(
  `const SESSION_KEY  = 'oot_drafts_v2';`,
  `const SESSION_KEY  = '${config.siteSlug}_drafts_v2';`
);
html = html.replace(
  `const HISTORY_KEY = 'oot_post_history';`,
  `const HISTORY_KEY = '${config.siteSlug}_post_history';`
);

// ── 9. Admin password hash ────────────────────────────────────────────────────
if (config.passwordHash) {
  html = html.replace(
    `'924325fbd85f063f2439544a4bd4cbe61433c2c83eb3e5a7ead42b984b7a2223'`,
    `'${config.passwordHash}'`
  );
} else {
  html = html.replace(
    `'924325fbd85f063f2439544a4bd4cbe61433c2c83eb3e5a7ead42b984b7a2223'`,
    `'REPLACE_WITH_YOUR_PASSWORD_HASH'`
  );
}

// ── 10. Research source toggles ───────────────────────────────────────────────
if (config.researchSources?.length) {
  const indent = '        ';
  const rows = config.researchSources.map(s => {
    const on = s.defaultOn !== false ? ' on' : '';
    return `${indent}<div class="toggle-row">\n${indent}  <span>${s.emoji} ${s.label}</span>\n${indent}  <button class="toggle${on}" onclick="this.classList.toggle('on')"></button>\n${indent}</div>`;
  }).join('\n');

  // Replace the entire research-toggles block
  html = html.replace(
    /<div class="research-toggles">[\s\S]*?<\/div>\s*(?=\s*<\/div>\s*\n\s*<button class="run-btn")/,
    `<div class="research-toggles">\n${rows}\n      </div>\n      `
  );
}

// ── 11. Weekly theme placeholder ─────────────────────────────────────────────
if (config.themePlaceholder) {
  html = html.replace(
    `placeholder="HS2 update, new business spotlight…"`,
    `placeholder="${config.themePlaceholder}"`
  );
}

// ── 12. Idle state description ────────────────────────────────────────────────
if (config.idleDescription) {
  html = html.replace(
    /(<div id="idleState"[^>]*>[\s\S]*?<p>)[^<]+(<\/p>)/,
    `$1${config.idleDescription}$2`
  );
}

// ── 13. Pipeline research log messages ───────────────────────────────────────
if (config.pipelineLogs?.length) {
  const logs = config.pipelineLogs;
  const delays = logs.map((_, i) => i === 0 ? 0 : 400 + i * 500);
  const lines = logs.map((msg, i) => {
    const isLast = i === logs.length - 1;
    const cls    = i === 0 ? '' : isLast ? `, 'done'` : `, 'info'`;
    return `  addLog(log, '${msg}', ${delays[i]}${cls});`;
  }).join('\n');

  html = html.replace(
    /addLog\(log, '> Initialising Old Oak Town research pipeline…'[\s\S]*?addLog\(log, '> Research complete[^;]+;/,
    lines
  );
}

// ── 14. Platform config block ─────────────────────────────────────────────────
if (config.platforms?.length) {
  const platLines = config.platforms.map(p => {
    return `  { id: '${p.id}', label: '${p.label}', emoji: '${p.emoji}', css: '${p.css}', color: '${p.color}', bg: '${p.bg}', charLimit: ${p.charLimit}, requiresMedia: ${p.requiresMedia}, defaultTime: '${p.defaultTime}' },`;
  }).join('\n');

  html = html.replace(
    /const PLATFORMS = \[[\s\S]*?\];(\s*\/\/ ═══[^\n]*END PLATFORM CONFIG[^\n]*)?/,
    `const PLATFORMS = [\n${platLines}\n];`
  );
}

// ── Write output ──────────────────────────────────────────────────────────────
const outDir = path.dirname(path.resolve(outputPath));
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outputPath, html, 'utf8');

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n✓  Generated: ${outputPath}`);
console.log(`   Site:      ${config.siteName} (${config.siteSlug})`);
if (config.researchSources?.length) {
  console.log(`   Sources:   ${config.researchSources.map(s => s.label).join(', ')}`);
}
if (config.platforms?.length) {
  console.log(`   Platforms: ${config.platforms.map(p => p.label).join(', ')}`);
}

if (!config.passwordHash) {
  console.log(`\n⚠  No passwordHash set in config.`);
  console.log(`   Generate one at: https://emn178.github.io/online-tools/sha256.html`);
  console.log(`   Then add "passwordHash": "<hash>" to ${configPath}`);
}

console.log('');
