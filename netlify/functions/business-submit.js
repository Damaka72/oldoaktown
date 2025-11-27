// Netlify Function to handle business submission
// This runs serverlessly when deployed to Netlify

const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const data = JSON.parse(event.body);

        console.log('Received business submission:', {
            businessName: data.businessName,
            package: data.package,
            email: data.email
        });

        // Validate required fields
        if (!data.businessName || !data.email || !data.package) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }

        // Here you can:
        // 1. Save to a database (Airtable, Google Sheets, MongoDB, etc.)
        // 2. Send email notification
        // 3. Create in CMS (if using one)

        // Option 1: Save to Airtable (example)
        // await saveToAirtable(data);

        // Option 2: Save to Google Sheets (example)
        // await saveToGoogleSheets(data);

        // Option 3: Send email notification
        await sendEmailNotification(data);

        // Option 4: Save to JSON file (simple option for testing)
        // Note: This won't work in production Netlify, use a database instead
        await saveToFile(data);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Submission received successfully',
                submissionId: data.stripeSessionId || Date.now().toString()
            })
        };
    } catch (error) {
        console.error('Error processing submission:', error);

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};

// Send email notification to admin
async function sendEmailNotification(data) {
    // Configure email (use environment variables in production)
    const transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    const emailContent = `
        New Business Listing Submission

        Business Name: ${data.businessName}
        Category: ${data.category}
        Package: ${data.package}
        Payment Frequency: ${data.frequency || 'N/A'}

        Contact Information:
        Email: ${data.email}
        Phone: ${data.phone}
        Address: ${data.address || 'N/A'}
        Postcode: ${data.postcode || 'N/A'}

        Website: ${data.website || 'N/A'}

        Description:
        ${data.description}

        Social Media:
        Instagram: ${data.instagram || 'N/A'}
        Twitter: ${data.twitter || 'N/A'}
        LinkedIn: ${data.linkedin || 'N/A'}

        Opening Hours: ${data.hours || 'N/A'}
        Special Offers: ${data.offers || 'N/A'}
        Target Audience: ${data.audience || 'N/A'}

        Payment Status: ${data.paymentStatus || 'Pending'}
        Stripe Session ID: ${data.stripeSessionId || 'N/A'}
        Submitted: ${data.submittedAt}
    `;

    try {
        // Send to admin
        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Old Oak Town" <noreply@oldoaktown.co.uk>',
            to: process.env.ADMIN_EMAIL || 'admin@oldoaktown.co.uk',
            subject: `New Business Listing: ${data.businessName}`,
            text: emailContent
        });

        // Send confirmation to customer
        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Old Oak Town" <noreply@oldoaktown.co.uk>',
            to: data.email,
            subject: 'Your Business Listing Submission - Old Oak Town',
            text: `Dear ${data.businessName},\n\nThank you for submitting your business to Old Oak Town!\n\nWe've received your ${data.package} listing and our team will review it within 24 hours.\n\nYou'll receive another email once your listing is live on the site.\n\nBest regards,\nThe Old Oak Town Team`
        });

        console.log('Email notifications sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
        // Don't fail the whole request if email fails
    }
}

// Save to file (for development/testing only - use database in production)
async function saveToFile(data) {
    const fs = require('fs').promises;
    const path = require('path');

    try {
        const submissionsDir = path.join(process.cwd(), 'submissions');

        // Create directory if it doesn't exist
        try {
            await fs.mkdir(submissionsDir, { recursive: true });
        } catch (err) {
            // Directory might already exist
        }

        const filename = `submission-${Date.now()}.json`;
        const filepath = path.join(submissionsDir, filename);

        await fs.writeFile(filepath, JSON.stringify(data, null, 2));

        console.log('Submission saved to file:', filename);
    } catch (error) {
        console.error('Error saving to file:', error);
        // Don't fail the request if file save fails
    }
}

// Example: Save to Airtable (uncomment and configure to use)
/*
async function saveToAirtable(data) {
    const Airtable = require('airtable');
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    await base('Business Submissions').create([
        {
            fields: {
                'Business Name': data.businessName,
                'Email': data.email,
                'Phone': data.phone,
                'Package': data.package,
                'Frequency': data.frequency,
                'Description': data.description,
                'Website': data.website,
                'Status': data.paymentStatus === 'completed' ? 'Paid' : 'Pending',
                'Submitted': data.submittedAt,
                'Stripe Session': data.stripeSessionId
            }
        }
    ]);
}
*/

// Example: Save to Google Sheets (uncomment and configure to use)
/*
async function saveToGoogleSheets(data) {
    const { GoogleSpreadsheet } = require('google-spreadsheet');
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);

    await doc.useServiceAccountAuth({
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
    });

    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    await sheet.addRow({
        'Business Name': data.businessName,
        'Email': data.email,
        'Phone': data.phone,
        'Package': data.package,
        'Frequency': data.frequency,
        'Description': data.description,
        'Website': data.website,
        'Status': data.paymentStatus === 'completed' ? 'Paid' : 'Pending',
        'Submitted': data.submittedAt,
        'Stripe Session': data.stripeSessionId
    });
}
*/
