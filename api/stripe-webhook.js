/**
 * API Endpoint: Stripe Webhook Handler
 *
 * This endpoint receives webhook notifications from Stripe when:
 * - A checkout session is completed (payment succeeded)
 * - A subscription is created, updated, or cancelled
 *
 * It matches the payment to a pending submission and updates the status.
 *
 * SECURITY: This endpoint verifies the Stripe webhook signature to ensure
 * the request actually came from Stripe.
 */

import fs from 'fs';
import path from 'path';
import Stripe from 'stripe';

// Initialize Stripe with your secret key
// You'll need to set this as an environment variable in Vercel
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// This is your Stripe webhook signing secret
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export const config = {
  api: {
    bodyParser: false, // Disable body parsing, we need the raw body for signature verification
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get the raw body for signature verification
  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    // Verify the webhook signature
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    } else {
      // In development, parse the body directly (NOT SECURE - for testing only)
      console.warn('⚠️ WARNING: Webhook signature verification is disabled. Set STRIPE_WEBHOOK_SECRET in production!');
      event = JSON.parse(buf.toString());
    }
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
        console.log('✅ Subscription created:', event.data.object.id);
        break;

      case 'customer.subscription.updated':
        console.log('ℹ️ Subscription updated:', event.data.object.id);
        break;

      case 'customer.subscription.deleted':
        console.log('⚠️ Subscription cancelled:', event.data.object.id);
        // You could send an email notification here
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

/**
 * Handle successful checkout session
 */
async function handleCheckoutCompleted(session) {
  console.log('🎉 Checkout completed!');
  console.log('Session ID:', session.id);
  console.log('Customer Email:', session.customer_email);
  console.log('Amount Total:', session.amount_total);

  const customerEmail = session.customer_email;
  const customerId = session.customer;

  if (!customerEmail) {
    console.error('❌ No customer email in session');
    return;
  }

  // Find the matching pending submission
  const dataPath = path.join(process.cwd(), 'data', 'pending-listings.json');
  let data = { submissions: [] };

  try {
    const fileContent = fs.readFileSync(dataPath, 'utf8');
    data = JSON.parse(fileContent);
  } catch (error) {
    console.error('Error reading pending listings:', error);
    return;
  }

  // Find submission by email (most recent if multiple)
  const submissionIndex = data.submissions.findIndex(
    sub => sub.email.toLowerCase() === customerEmail.toLowerCase() &&
           sub.status === 'awaiting_payment'
  );

  if (submissionIndex === -1) {
    console.error(`❌ No pending submission found for email: ${customerEmail}`);
    console.log('This might be an upgrade from an existing customer.');
    // You could create a new submission here or log it for manual review
    return;
  }

  // Update the submission
  data.submissions[submissionIndex].status = 'paid';
  data.submissions[submissionIndex].paymentConfirmedAt = new Date().toISOString();
  data.submissions[submissionIndex].stripeSessionId = session.id;
  data.submissions[submissionIndex].stripeCustomerId = customerId;

  // Write back to file
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

  console.log(`✅ Payment confirmed for: ${data.submissions[submissionIndex].businessName}`);
  console.log(`📧 Email: ${customerEmail}`);
  console.log(`💰 Amount: £${(session.amount_total / 100).toFixed(2)}`);

  // TODO: Optional - send confirmation email to customer
  // TODO: Optional - add email to newsletter service
  // await addToNewsletter(customerEmail, data.submissions[submissionIndex].businessName);
}

/**
 * Helper function to get raw body from request
 */
async function buffer(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Optional: Add customer to newsletter
 * Uncomment and implement based on your newsletter service
 */
/*
async function addToNewsletter(email, businessName) {
  // Example for Mailchimp:
  // const mailchimp = require('@mailchimp/mailchimp_marketing');
  // await mailchimp.lists.addListMember(LIST_ID, { email_address: email });

  // Example for ConvertKit:
  // const response = await fetch('https://api.convertkit.com/v3/forms/FORM_ID/subscribe', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ email, api_key: process.env.CONVERTKIT_API_KEY })
  // });

  console.log(`📧 Added ${email} to newsletter`);
}
*/
