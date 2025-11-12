/**
 * API Endpoint: Approve Business Listing
 *
 * This endpoint approves a paid submission and moves it to the approved list
 * It updates the status to 'approved' and adds a timestamp
 *
 * TODO: Optionally send confirmation email to customer
 * TODO: Optionally add to newsletter mailing list
 */

import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { submissionId, password } = req.body;

    // Verify admin password
    const adminPassword = process.env.ADMIN_PASSWORD || 'oldoak2024';
    if (password !== adminPassword) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!submissionId) {
      return res.status(400).json({ error: 'Missing submissionId' });
    }

    // Read pending listings
    const pendingPath = path.join(process.cwd(), 'data', 'pending-listings.json');
    let pendingData = { submissions: [] };

    try {
      const fileContent = fs.readFileSync(pendingPath, 'utf8');
      pendingData = JSON.parse(fileContent);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to read pending listings' });
    }

    // Find the submission
    const submissionIndex = pendingData.submissions.findIndex(s => s.id === submissionId);

    if (submissionIndex === -1) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const submission = pendingData.submissions[submissionIndex];

    // Verify it's been paid
    if (submission.status !== 'paid') {
      return res.status(400).json({
        error: 'Can only approve paid submissions',
        currentStatus: submission.status
      });
    }

    // Update status
    submission.status = 'approved';
    submission.approvedAt = new Date().toISOString();

    // Save back to pending (we keep the record)
    fs.writeFileSync(pendingPath, JSON.stringify(pendingData, null, 2));

    // Also add to approved listings
    const approvedPath = path.join(process.cwd(), 'data', 'approved-listings.json');
    let approvedData = { businesses: [] };

    try {
      const approvedContent = fs.readFileSync(approvedPath, 'utf8');
      approvedData = JSON.parse(approvedContent);
    } catch (error) {
      // File doesn't exist, use default structure
    }

    // Format for directory display
    const businessListing = {
      id: submission.id,
      name: submission.businessName,
      category: submission.category,
      description: submission.description,
      contactName: submission.contactName,
      email: submission.email,
      phone: submission.phone,
      website: submission.website,
      address: submission.address,
      logoUrl: submission.logoUrl,
      package: submission.package,
      frequency: submission.frequency,
      stripeCustomerId: submission.stripeCustomerId,
      approvedAt: submission.approvedAt,
      featured: submission.package === 'featured' || submission.package === 'premium' || submission.package === 'newsletter'
    };

    approvedData.businesses.push(businessListing);

    // Write approved listings
    fs.writeFileSync(approvedPath, JSON.stringify(approvedData, null, 2));

    console.log(`✅ Listing approved: ${submission.businessName}`);
    console.log(`📧 Customer email: ${submission.email}`);

    // TODO: Send confirmation email
    // await sendConfirmationEmail(submission);

    // TODO: Add to newsletter
    // await addToNewsletter(submission.email, submission.businessName);

    return res.status(200).json({
      success: true,
      message: 'Listing approved successfully',
      business: businessListing
    });

  } catch (error) {
    console.error('Error approving listing:', error);
    return res.status(500).json({
      error: 'Failed to approve listing',
      details: error.message
    });
  }
}
