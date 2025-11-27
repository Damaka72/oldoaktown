// Simple Express server for Old Oak Town
// Alternative to Netlify Functions for self-hosting

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Business submission endpoint
app.post('/api/business-submit', async (req, res) => {
    try {
        const data = req.body;

        console.log('Received business submission:', {
            businessName: data.businessName,
            package: data.package,
            email: data.email
        });

        // Validate required fields
        if (!data.businessName || !data.email || !data.package) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Create submissions directory if it doesn't exist
        const submissionsDir = path.join(__dirname, 'submissions');
        try {
            await fs.mkdir(submissionsDir, { recursive: true });
        } catch (err) {
            // Directory might already exist
        }

        // Save submission to JSON file
        const timestamp = Date.now();
        const filename = `submission-${timestamp}.json`;
        const filepath = path.join(submissionsDir, filename);

        await fs.writeFile(filepath, JSON.stringify(data, null, 2));

        console.log('Submission saved:', filename);

        // Send email notification (implement with nodemailer)
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
            await sendEmailNotification(data);
        }

        res.json({
            success: true,
            message: 'Submission received successfully',
            submissionId: data.stripeSessionId || timestamp.toString()
        });

    } catch (error) {
        console.error('Error processing submission:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Get all submissions (admin endpoint - should be protected in production)
app.get('/api/submissions', async (req, res) => {
    try {
        const submissionsDir = path.join(__dirname, 'submissions');
        const files = await fs.readdir(submissionsDir);

        const submissions = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                const content = await fs.readFile(
                    path.join(submissionsDir, file),
                    'utf8'
                );
                submissions.push(JSON.parse(content));
            }
        }

        // Sort by submission date (newest first)
        submissions.sort((a, b) =>
            new Date(b.submittedAt) - new Date(a.submittedAt)
        );

        res.json(submissions);
    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).json({ error: 'Failed to fetch submissions' });
    }
});

// Email notification function
async function sendEmailNotification(data) {
    const nodemailer = require('nodemailer');

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

        console.log('Email notifications sent');
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

// Serve HTML files
app.get('*', (req, res) => {
    const file = req.path === '/' ? 'index.html' : req.path;
    res.sendFile(path.join(__dirname, file), (err) => {
        if (err) {
            res.status(404).send('Page not found');
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Environment:', process.env.NODE_ENV || 'development');
});
