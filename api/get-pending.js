// api/get-pending.js
// Admin dashboard: view and approve pending business listings
// GET /api/get-pending?password=YOUR_ADMIN_PASSWORD

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    const providedPassword = req.query.password;

    if (!adminPassword || providedPassword !== adminPassword) {
        res.setHeader('Content-Type', 'text/html');
        return res.status(401).send(loginPageHtml());
    }

    try {
        const { data, error } = await supabase
            .from('businesses')
            .select('id, business_name, category, email, phone, address, postcode, description, website, logo_url, tier, billing_frequency, status, stripe_payment_status, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const rows = data || [];
        const awaitingPayment = rows.filter(b => b.status === 'pending_payment');
        const needsApproval   = rows.filter(b => b.status === 'pending');
        const approved        = rows.filter(b => b.status === 'approved');

        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(generateAdminHTML(awaitingPayment, needsApproval, approved));
    } catch (err) {
        console.error('get-pending error:', err);
        return res.status(500).json({ error: 'Failed to load listings' });
    }
};

// ─────────────────────────────────────────────────────────
// HTML helpers
// ─────────────────────────────────────────────────────────

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

function loginPageHtml() {
    return `<!DOCTYPE html>
<html>
<head>
  <title>Admin Login - Old Oak Town</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #2D5016 0%, #8B4513 100%); }
    .login-box { background: white; padding: 2rem; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); text-align: center; }
    input { padding: 0.75rem; font-size: 1rem; border: 2px solid #ddd; border-radius: 5px; width: 250px; margin: 1rem 0; }
    button { padding: 0.75rem 2rem; background: #2D5016; color: white; border: none; border-radius: 5px; font-size: 1rem; cursor: pointer; }
    button:hover { background: #8B4513; }
  </style>
</head>
<body>
  <div class="login-box">
    <h1>🔐 Admin Access</h1>
    <p>Enter password to view pending listings</p>
    <form method="GET">
      <input type="password" name="password" placeholder="Admin Password" required autofocus>
      <br>
      <button type="submit">Login</button>
    </form>
  </div>
</body>
</html>`;
}

function generateAdminHTML(awaitingPayment, needsApproval, approved) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard - Old Oak Town</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 2rem; }
    .header { background: linear-gradient(135deg, #2D5016 0%, #8B4513 100%); color: white; padding: 2rem; border-radius: 10px; margin-bottom: 2rem; }
    .stats { display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; }
    .stat-card { background: white; padding: 1.5rem; border-radius: 10px; flex: 1; min-width: 200px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .stat-number { font-size: 2.5rem; font-weight: bold; color: #2D5016; }
    .stat-label { color: #666; margin-top: 0.5rem; }
    .section { background: white; padding: 2rem; border-radius: 10px; margin-bottom: 2rem; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .section h2 { color: #2D5016; margin-bottom: 1.5rem; padding-bottom: 0.5rem; border-bottom: 2px solid #2D5016; }
    .listing-card { border: 2px solid #e0e0e0; padding: 1.5rem; margin-bottom: 1rem; border-radius: 10px; background: #fafafa; }
    .listing-card.paid { border-color: #28a745; background: #f0fff4; }
    .listing-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem; }
    .business-name { font-size: 1.5rem; font-weight: bold; color: #2D5016; }
    .status-badge { padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.9rem; font-weight: 600; }
    .status-awaiting { background: #fff3cd; color: #856404; }
    .status-pending  { background: #d4edda; color: #155724; }
    .status-approved { background: #cce5ff; color: #004085; }
    .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin: 1rem 0; }
    .detail { display: flex; flex-direction: column; }
    .detail-label { font-size: 0.85rem; color: #666; font-weight: 600; }
    .detail-value { color: #333; margin-top: 0.25rem; }
    .description-box { background: white; padding: 1rem; border-radius: 5px; margin: 1rem 0; border-left: 3px solid #2D5016; }
    .actions { display: flex; gap: 1rem; margin-top: 1rem; }
    .btn { padding: 0.75rem 1.5rem; border: none; border-radius: 5px; cursor: pointer; font-weight: 600; transition: all 0.3s; }
    .btn-approve { background: #28a745; color: white; }
    .btn-approve:hover { background: #218838; }
    .btn-reject { background: #dc3545; color: white; }
    .btn-reject:hover { background: #c82333; }
    .empty-state { text-align: center; padding: 3rem; color: #999; }
    .timestamp { font-size: 0.85rem; color: #999; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏘️ Old Oak Town - Admin Dashboard</h1>
    <p>Manage business listing submissions</p>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="stat-number">${needsApproval.length}</div>
      <div class="stat-label">Needs Approval</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${awaitingPayment.length}</div>
      <div class="stat-label">Awaiting Payment</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${approved.length}</div>
      <div class="stat-label">Approved</div>
    </div>
  </div>

  <!-- NEEDS APPROVAL (PRIORITY) -->
  <div class="section">
    <h2>📋 Needs Approval</h2>
    ${needsApproval.length === 0 ? '<div class="empty-state">No listings awaiting approval</div>' : ''}
    ${needsApproval.map(b => generateListingCard(b, true)).join('')}
  </div>

  <!-- AWAITING PAYMENT -->
  <div class="section">
    <h2>⏳ Awaiting Payment</h2>
    ${awaitingPayment.length === 0 ? '<div class="empty-state">No submissions awaiting payment</div>' : ''}
    ${awaitingPayment.map(b => generateListingCard(b, false)).join('')}
  </div>

  <!-- APPROVED (FOR REFERENCE) -->
  <div class="section">
    <h2>✅ Approved Listings</h2>
    ${approved.length === 0 ? '<div class="empty-state">No approved listings yet</div>' : ''}
    ${approved.map(b => generateListingCard(b, false)).join('')}
  </div>

  <script>
    // Read the password from the current URL (page is already auth-gated)
    const _adminPassword = new URLSearchParams(window.location.search).get('password') || '';

    async function approveListing(id) {
      if (!confirm('Are you sure you want to approve this listing?')) return;
      try {
        const response = await fetch('/api/approve-listing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submissionId: id, password: _adminPassword })
        });
        const result = await response.json();
        if (result.success) {
          alert('✅ Listing approved!');
          window.location.reload();
        } else {
          alert('❌ Error: ' + result.error);
        }
      } catch (error) {
        alert('❌ Error: ' + error.message);
      }
    }
  </script>
</body>
</html>`;
}

function generateListingCard(b, showApprove) {
    const isPaid = b.stripe_payment_status === 'active';
    const cardClass = (b.status === 'pending' && isPaid) ? 'paid' : '';
    const statusBadge = b.status === 'pending_payment' ? 'status-awaiting' :
                        b.status === 'pending'         ? 'status-pending'  : 'status-approved';
    const statusText  = b.status === 'pending_payment' ? '⏳ Awaiting Payment' :
                        (b.status === 'pending' && isPaid) ? '💳 Paid — Needs Approval' :
                        b.status === 'pending'              ? '📋 Free — Needs Approval' : '✅ Approved';

    const safeId = escapeHtml(b.id);

    return `
    <div class="listing-card ${cardClass}">
      <div class="listing-header">
        <div class="business-name">${escapeHtml(b.business_name)}</div>
        <span class="status-badge ${statusBadge}">${statusText}</span>
      </div>

      <div class="detail-grid">
        <div class="detail">
          <span class="detail-label">Email</span>
          <span class="detail-value">${escapeHtml(b.email)}</span>
        </div>
        <div class="detail">
          <span class="detail-label">Phone</span>
          <span class="detail-value">${escapeHtml(b.phone) || 'N/A'}</span>
        </div>
        <div class="detail">
          <span class="detail-label">Category</span>
          <span class="detail-value">${escapeHtml(b.category) || 'N/A'}</span>
        </div>
        <div class="detail">
          <span class="detail-label">Tier</span>
          <span class="detail-value">${escapeHtml(formatTier(b.tier))} — ${escapeHtml(formatFrequency(b.billing_frequency))}</span>
        </div>
        <div class="detail">
          <span class="detail-label">Website</span>
          <span class="detail-value">${b.website ? `<a href="${escapeHtml(b.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.website)}</a>` : 'N/A'}</span>
        </div>
        <div class="detail">
          <span class="detail-label">Address</span>
          <span class="detail-value">${escapeHtml(b.address) || 'N/A'}${b.postcode ? ', ' + escapeHtml(b.postcode) : ''}</span>
        </div>
      </div>

      <div class="description-box">
        <strong>Business Description:</strong><br>
        ${escapeHtml(b.description) || 'No description provided'}
      </div>

      ${b.logo_url ? `
      <div class="detail-grid">
        <div class="detail">
          <span class="detail-label">Logo</span>
          <span class="detail-value"><a href="${escapeHtml(b.logo_url)}" target="_blank" rel="noopener noreferrer">View Logo</a></span>
        </div>
      </div>
      ` : ''}

      <div class="timestamp">
        Submitted: ${escapeHtml(b.created_at ? new Date(b.created_at).toLocaleString('en-GB') : 'Unknown')}
        ${b.stripe_payment_status ? ` · Payment: ${escapeHtml(b.stripe_payment_status)}` : ''}
      </div>

      ${showApprove ? `
        <div class="actions">
          <button class="btn btn-approve" onclick="approveListing('${safeId}')">
            ✅ Approve &amp; Publish
          </button>
        </div>
      ` : ''}
    </div>`;
}

function formatTier(tier) {
    const names = { 'free': 'Free', 'featured': 'Featured (£35/mo)', 'premium': 'Premium (£75/mo)', 'newsletter': 'Newsletter Sponsor (£150/mo)' };
    return names[tier] || tier || 'N/A';
}

function formatFrequency(freq) {
    if (!freq) return '';
    return freq === 'monthly' ? 'Monthly' : 'Annual';
}
