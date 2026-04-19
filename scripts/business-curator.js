/**
 * Business Directory Manager Agent — Old Oak Town
 *
 * Reviews pending business submissions using Claude:
 * scores completeness, drafts approval/rejection emails,
 * and saves action cards for the admin dashboard.
 *
 * Run: node scripts/business-curator.js
 * Schedule: 9 AM and 5 PM UTC daily via GitHub Actions
 */

const Anthropic = require('@anthropic-ai/sdk');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SUBMISSIONS_DIR = path.join(__dirname, '../data/business-submissions');
const REVIEW_DIR = path.join(__dirname, '../data/business-review');

const REQUIRED_FIELDS = ['businessName', 'category', 'description', 'email', 'phone', 'address'];
const RECOMMENDED_FIELDS = ['website', 'openingHours', 'imageUrl'];

function readPendingSubmissions() {
  if (!fs.existsSync(SUBMISSIONS_DIR)) return [];
  return fs.readdirSync(SUBMISSIONS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(filename => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(SUBMISSIONS_DIR, filename), 'utf8'));
        if (data.status !== 'pending') return null;
        const reviewPath = path.join(REVIEW_DIR, filename.replace('.json', '-review.json'));
        if (fs.existsSync(reviewPath)) return null; // already reviewed
        return { ...data, _filename: filename };
      } catch { return null; }
    })
    .filter(Boolean);
}

function assessCompleteness(submission) {
  const missingRequired = REQUIRED_FIELDS.filter(f => !submission[f]?.toString().trim());
  const missingRecommended = RECOMMENDED_FIELDS.filter(f => !submission[f]?.toString().trim());
  const score = Math.round(
    ((REQUIRED_FIELDS.length - missingRequired.length) / REQUIRED_FIELDS.length) * 70 +
    ((RECOMMENDED_FIELDS.length - missingRecommended.length) / RECOMMENDED_FIELDS.length) * 30
  );
  return { score, missingRequired, missingRecommended };
}

async function reviewSubmission(submission, completeness) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: 'You are a community manager. Respond with valid JSON only, no markdown.',
    messages: [{
      role: 'user',
      content: `You manage the Old Oak Town business directory for Old Oak Common, West London.

SUBMISSION:
Business: ${submission.businessName || 'Not provided'}
Category: ${submission.category || 'Not provided'}
Description: ${submission.description || 'Not provided'}
Address: ${submission.address || 'Not provided'}
Phone: ${submission.phone || 'Not provided'}
Email: ${submission.email || 'Not provided'}
Website: ${submission.website || 'Not provided'}
Hours: ${submission.openingHours || 'Not provided'}
Tier: ${submission.tier || 'Free'}

COMPLETENESS: ${completeness.score}/100
Missing required: ${completeness.missingRequired.join(', ') || 'None'}
Missing recommended: ${completeness.missingRecommended.join(', ') || 'None'}

Return JSON with this exact structure:
{
  "recommendation": "approve" | "request_info" | "reject",
  "reason": "one sentence",
  "approvalEmail": { "subject": "...", "body": "..." },
  "requestInfoEmail": { "subject": "...", "body": "..." },
  "notes": "any concerns for the human reviewer"
}

Email bodies: warm, professional, under 150 words. Use the business name.`
    }],
  });
  try { return JSON.parse(response.content[0].text.trim()); }
  catch { return { recommendation: 'request_info', reason: 'AI parse error — manual review required', notes: response.content[0].text }; }
}

async function notifyAdmin(submission, review, completeness) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.ADMIN_EMAIL) return;
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const emoji = { approve: '✅', request_info: '⚠️', reject: '❌' }[review.recommendation] || '📋';
  await t.sendMail({
    from: `"Old Oak Town Bot" <${process.env.SMTP_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `${emoji} Business Submission: ${submission.businessName} — ${review.recommendation.replace('_', ' ').toUpperCase()}`,
    html: `<h2>${emoji} Business Submission Review</h2>
<p><strong>Business:</strong> ${submission.businessName}</p>
<p><strong>Category:</strong> ${submission.category}</p>
<p><strong>Completeness:</strong> ${completeness.score}/100</p>
<p><strong>AI Recommendation:</strong> ${review.recommendation.replace('_', ' ')}</p>
<p><strong>Reason:</strong> ${review.reason}</p>
${review.notes ? `<p><strong>Notes:</strong> ${review.notes}</p>` : ''}
<hr>
<h3>Approval Email Draft:</h3>
<p><em>Subject: ${review.approvalEmail?.subject || 'N/A'}</em></p>
<pre style="background:#f5f5f5;padding:12px;border-radius:4px">${review.approvalEmail?.body || 'N/A'}</pre>
<h3>Info Request Email Draft:</h3>
<p><em>Subject: ${review.requestInfoEmail?.subject || 'N/A'}</em></p>
<pre style="background:#f5f5f5;padding:12px;border-radius:4px">${review.requestInfoEmail?.body || 'N/A'}</pre>
<hr>
<p><a href="${process.env.SITE_URL || 'https://www.oldoaktown.co.uk'}/admin/">Review in Admin Dashboard →</a></p>`,
  });
}

async function main() {
  console.log('🏪 Business Directory Manager starting...');
  if (!fs.existsSync(REVIEW_DIR)) fs.mkdirSync(REVIEW_DIR, { recursive: true });

  const submissions = readPendingSubmissions();
  console.log(`📥 ${submissions.length} pending submission(s)`);
  if (submissions.length === 0) { console.log('✅ No pending submissions.'); return; }

  for (const submission of submissions) {
    console.log(`\n🔍 Reviewing: ${submission.businessName}`);
    const completeness = assessCompleteness(submission);
    console.log(`   Completeness: ${completeness.score}/100`);
    const review = await reviewSubmission(submission, completeness);
    console.log(`   Recommendation: ${review.recommendation}`);

    const card = {
      submissionId: submission.id || submission._filename,
      businessName: submission.businessName,
      submittedAt: submission.submittedAt || new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
      completeness,
      aiRecommendation: review.recommendation,
      reason: review.reason,
      notes: review.notes,
      draftEmails: { approval: review.approvalEmail, requestInfo: review.requestInfoEmail },
      submission,
    };

    const cardPath = path.join(REVIEW_DIR, submission._filename.replace('.json', '-review.json'));
    fs.writeFileSync(cardPath, JSON.stringify(card, null, 2));
    await notifyAdmin(submission, review, completeness);
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n✅ ${submissions.length} submission(s) reviewed.`);
}

main().catch(err => { console.error('❌ Fatal error:', err); process.exit(1); });
