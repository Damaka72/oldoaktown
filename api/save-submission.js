/**
 * API Endpoint: Save Business Submission
 *
 * This endpoint receives business listing form data BEFORE payment
 * and stores it in pending-listings.json with status "awaiting_payment"
 *
 * When the Stripe webhook confirms payment, the status will be updated to "paid"
 */

import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const submissionData = req.body;

    // Validate required fields
    if (!submissionData.email || !submissionData.businessName) {
      return res.status(400).json({
        error: 'Missing required fields: email and businessName are required'
      });
    }

    // Create submission object
    const submission = {
      id: generateId(),
      ...submissionData,
      status: 'awaiting_payment',
      submittedAt: new Date().toISOString(),
      paymentConfirmedAt: null,
      approvedAt: null,
      stripeSessionId: null,
      stripeCustomerId: null
    };

    // Read existing pending submissions
    const dataPath = path.join(process.cwd(), 'data', 'pending-listings.json');
    let data = { submissions: [] };

    try {
      const fileContent = fs.readFileSync(dataPath, 'utf8');
      data = JSON.parse(fileContent);
    } catch (error) {
      // File doesn't exist or is empty, use default structure
      console.log('Creating new pending-listings.json file');
    }

    // Add new submission
    data.submissions.push(submission);

    // Write back to file
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

    console.log(`✅ Submission saved: ${submission.businessName} (${submission.email})`);

    // Return success with submission ID
    return res.status(200).json({
      success: true,
      submissionId: submission.id,
      message: 'Submission saved successfully'
    });

  } catch (error) {
    console.error('Error saving submission:', error);
    return res.status(500).json({
      error: 'Failed to save submission',
      details: error.message
    });
  }
}

// Generate unique ID for submission
function generateId() {
  return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
