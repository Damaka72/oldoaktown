/**
 * API Endpoint: Get Pending Listings (Admin Page)
 *
 * This endpoint displays all pending business submissions
 * Shows both "awaiting_payment" and "paid" submissions
 *
 * Access: https://oldoaktown.vercel.app/api/get-pending?password=YOUR_PASSWORD
 *
 * Set ADMIN_PASSWORD environment variable in Vercel for security
 */

import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Simple password protection
  const adminPassword = process.env.ADMIN_PASSWORD || 'oldoak2024'; // Change this!
  const providedPassword = req.query.password;

  if (providedPassword !== adminPassword) {
    return res.status(401).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admin Login - Old Oak Town</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #2D5016 0%, #8B4513 100%);
          }
          .login-box {
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            text-align: center;
          }
          input {
            padding: 0.75rem;
            font-size: 1rem;
            border: 2px solid #ddd;
            border-radius: 5px;
            width: 250px;
            margin: 1rem 0;
          }
          button {
            padding: 0.75rem 2rem;
            background: #2D5016;
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 1rem;
            cursor: pointer;
          }
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
      </html>
    `);
  }

  // Read pending listings
  const dataPath = path.join(process.cwd(), 'data', 'pending-listings.json');
  let data = { submissions: [] };

  try {
    const fileContent = fs.readFileSync(dataPath, 'utf8');
    data = JSON.parse(fileContent);
  } catch (error) {
    console.error('Error reading pending listings:', error);
  }

  // Filter by status
  const awaitingPayment = data.submissions.filter(s => s.status === 'awaiting_payment');
  const paid = data.submissions.filter(s => s.status === 'paid');
  const approved = data.submissions.filter(s => s.status === 'approved');

  // Generate HTML
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(generateAdminHTML(awaitingPayment, paid, approved, adminPassword));
}

function generateAdminHTML(awaitingPayment, paid, approved, password) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pending Listings - Old Oak Town Admin</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 2rem;
    }
    .header {
      background: linear-gradient(135deg, #2D5016 0%, #8B4513 100%);
      color: white;
      padding: 2rem;
      border-radius: 10px;
      margin-bottom: 2rem;
    }
    .stats {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }
    .stat-card {
      background: white;
      padding: 1.5rem;
      border-radius: 10px;
      flex: 1;
      min-width: 200px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .stat-number {
      font-size: 2.5rem;
      font-weight: bold;
      color: #2D5016;
    }
    .stat-label {
      color: #666;
      margin-top: 0.5rem;
    }
    .section {
      background: white;
      padding: 2rem;
      border-radius: 10px;
      margin-bottom: 2rem;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .section h2 {
      color: #2D5016;
      margin-bottom: 1.5rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #2D5016;
    }
    .listing-card {
      border: 2px solid #e0e0e0;
      padding: 1.5rem;
      margin-bottom: 1rem;
      border-radius: 10px;
      background: #fafafa;
    }
    .listing-card.paid {
      border-color: #28a745;
      background: #f0fff4;
    }
    .listing-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 1rem;
    }
    .business-name {
      font-size: 1.5rem;
      font-weight: bold;
      color: #2D5016;
    }
    .status-badge {
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .status-awaiting {
      background: #fff3cd;
      color: #856404;
    }
    .status-paid {
      background: #d4edda;
      color: #155724;
    }
    .status-approved {
      background: #cce5ff;
      color: #004085;
    }
    .detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
      margin: 1rem 0;
    }
    .detail {
      display: flex;
      flex-direction: column;
    }
    .detail-label {
      font-size: 0.85rem;
      color: #666;
      font-weight: 600;
    }
    .detail-value {
      color: #333;
      margin-top: 0.25rem;
    }
    .description-box {
      background: white;
      padding: 1rem;
      border-radius: 5px;
      margin: 1rem 0;
      border-left: 3px solid #2D5016;
    }
    .actions {
      display: flex;
      gap: 1rem;
      margin-top: 1rem;
    }
    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s;
    }
    .btn-approve {
      background: #28a745;
      color: white;
    }
    .btn-approve:hover {
      background: #218838;
    }
    .btn-reject {
      background: #dc3545;
      color: white;
    }
    .btn-reject:hover {
      background: #c82333;
    }
    .btn-view {
      background: #007bff;
      color: white;
    }
    .btn-view:hover {
      background: #0056b3;
    }
    .empty-state {
      text-align: center;
      padding: 3rem;
      color: #999;
    }
    .timestamp {
      font-size: 0.85rem;
      color: #999;
      margin-top: 0.5rem;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏘️ Old Oak Town - Admin Dashboard</h1>
    <p>Manage business listing submissions</p>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="stat-number">${awaitingPayment.length}</div>
      <div class="stat-label">Awaiting Payment</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${paid.length}</div>
      <div class="stat-label">Paid (Needs Approval)</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${approved.length}</div>
      <div class="stat-label">Approved</div>
    </div>
  </div>

  <!-- PAID SUBMISSIONS (PRIORITY) -->
  <div class="section">
    <h2>💰 Paid Submissions - Ready to Approve</h2>
    ${paid.length === 0 ? '<div class="empty-state">No paid submissions pending approval</div>' : ''}
    ${paid.map(sub => generateListingCard(sub, true, password)).join('')}
  </div>

  <!-- AWAITING PAYMENT -->
  <div class="section">
    <h2>⏳ Awaiting Payment</h2>
    ${awaitingPayment.length === 0 ? '<div class="empty-state">No submissions awaiting payment</div>' : ''}
    ${awaitingPayment.map(sub => generateListingCard(sub, false, password)).join('')}
  </div>

  <!-- APPROVED (FOR REFERENCE) -->
  <div class="section">
    <h2>✅ Approved Listings</h2>
    ${approved.length === 0 ? '<div class="empty-state">No approved listings yet</div>' : ''}
    ${approved.map(sub => generateListingCard(sub, false, password)).join('')}
  </div>

  <script>
    async function approveListing(id) {
      if (!confirm('Are you sure you want to approve this listing?')) return;

      try {
        const response = await fetch('/api/approve-listing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submissionId: id,
            password: '${password}'
          })
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

    function viewStripe(sessionId) {
      window.open('https://dashboard.stripe.com/test/payments/' + sessionId, '_blank');
    }
  </script>
</body>
</html>
  `;
}

function generateListingCard(sub, showApprove, password) {
  const statusClass = sub.status === 'paid' ? 'paid' : '';
  const statusBadge = sub.status === 'awaiting_payment' ? 'status-awaiting' :
                      sub.status === 'paid' ? 'status-paid' : 'status-approved';
  const statusText = sub.status === 'awaiting_payment' ? '⏳ Awaiting Payment' :
                     sub.status === 'paid' ? '💰 Paid' : '✅ Approved';

  return `
    <div class="listing-card ${statusClass}">
      <div class="listing-header">
        <div class="business-name">${sub.businessName}</div>
        <span class="status-badge ${statusBadge}">${statusText}</span>
      </div>

      <div class="detail-grid">
        <div class="detail">
          <span class="detail-label">Contact Person</span>
          <span class="detail-value">${sub.contactName || 'N/A'}</span>
        </div>
        <div class="detail">
          <span class="detail-label">Email</span>
          <span class="detail-value">${sub.email}</span>
        </div>
        <div class="detail">
          <span class="detail-label">Phone</span>
          <span class="detail-value">${sub.phone || 'N/A'}</span>
        </div>
        <div class="detail">
          <span class="detail-label">Category</span>
          <span class="detail-value">${sub.category || 'N/A'}</span>
        </div>
        <div class="detail">
          <span class="detail-label">Package</span>
          <span class="detail-value">${formatPackage(sub.package)} - ${formatFrequency(sub.frequency)}</span>
        </div>
        <div class="detail">
          <span class="detail-label">Website</span>
          <span class="detail-value">${sub.website ? `<a href="${sub.website}" target="_blank">${sub.website}</a>` : 'N/A'}</span>
        </div>
      </div>

      <div class="description-box">
        <strong>Business Description:</strong><br>
        ${sub.description || 'No description provided'}
      </div>

      <div class="detail-grid">
        <div class="detail">
          <span class="detail-label">Address</span>
          <span class="detail-value">${sub.address || 'N/A'}</span>
        </div>
        ${sub.logoUrl ? `
        <div class="detail">
          <span class="detail-label">Logo</span>
          <span class="detail-value"><a href="${sub.logoUrl}" target="_blank">View Logo</a></span>
        </div>
        ` : ''}
      </div>

      <div class="timestamp">
        Submitted: ${new Date(sub.submittedAt).toLocaleString()}<br>
        ${sub.paymentConfirmedAt ? `Payment Confirmed: ${new Date(sub.paymentConfirmedAt).toLocaleString()}<br>` : ''}
        ${sub.stripeSessionId ? `Stripe Session: ${sub.stripeSessionId}` : ''}
      </div>

      ${showApprove ? `
        <div class="actions">
          <button class="btn btn-approve" onclick="approveListing('${sub.id}')">
            ✅ Approve & Publish
          </button>
          ${sub.stripeSessionId ? `
            <button class="btn btn-view" onclick="viewStripe('${sub.stripeSessionId}')">
              💳 View in Stripe
            </button>
          ` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

function formatPackage(pkg) {
  const names = {
    'featured': 'Featured Listing',
    'premium': 'Premium Package',
    'newsletter': 'Newsletter Sponsor'
  };
  return names[pkg] || pkg;
}

function formatFrequency(freq) {
  return freq === 'monthly' ? 'Monthly' : 'Annual';
}
