const Anthropic = require('@anthropic-ai/sdk');
const nodemailer = require('nodemailer');

async function generateDigest() {
    console.log('Starting weekly digest generation...');

    const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
    });

    const today = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const prompt = `You are the editor of The Old Oak Weekly, a hyperlocal newsletter covering the Old Oak Common regeneration project in West London.

Today is ${today}.

Your task is to write a complete draft newsletter issue. Research and write about the following topics:

1. **HS2 & Station Update** — Any recent news about Old Oak Common station construction, HS2 progress, delays, or milestones
2. **Planning & Development** — Recent OPDC planning decisions, new housing approvals, consultations
3. **Local Business Spotlight** — Feature a business type or sector thriving in Park Royal or the surrounding area
4. **Community News** — Anything relevant to residents of North Acton, Harlesden, Park Royal, or Wormwood Scrubs
5. **Upcoming Events** — Any OPDC consultations, community meetings, or local events worth highlighting

Format the newsletter exactly like this:

---
SUBJECT LINE: [Write a compelling email subject line]

PREVIEW TEXT: [One sentence that appears under the subject line in email clients]

---

👋 WELCOME

[2-3 sentence warm intro from the editor's perspective, referencing something current]

---

🚄 HS2 & STATION UPDATE

[2-3 paragraphs covering latest station construction news. Be specific about what is known. If uncertain, say "reports suggest" or "according to latest updates"]

---

🏘️ PLANNING & DEVELOPMENT

[2-3 paragraphs on OPDC decisions, housing developments, planning applications]

---

🏪 BUSINESS SPOTLIGHT

[1-2 paragraphs featuring a local business sector or specific business type relevant to the area's growth]

---

👥 COMMUNITY NEWS

[1-2 paragraphs on community matters, resident groups, local issues]

---

📅 EVENTS & CONSULTATIONS

[List 2-3 upcoming events or consultations with dates if known]

---

✉️ SIGN OFF

[Brief friendly sign off from The Old Oak Weekly team]

---

Write in a warm, informative, community-focused tone. Be factual and honest — if something is uncertain or delayed (like HS2 timelines), report it accurately rather than being overly positive. This newsletter serves real residents who need reliable information.`;

    console.log('Calling Claude API...');

    const message = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 2000,
        messages: [
            {
                role: 'user',
                content: prompt
            }
        ]
    });

    const digestContent = message.content[0].text;
    console.log('Digest generated successfully');

    // Extract subject line
    const subjectMatch = digestContent.match(/SUBJECT LINE:\s*(.+)/);
    const subject = subjectMatch
        ? subjectMatch[1].trim()
        : `The Old Oak Weekly — ${today}`;

    // Send email
    const transporter = nodemailer.createTransporter({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    const emailBody = `
THE OLD OAK WEEKLY — DRAFT FOR YOUR REVIEW
============================================
Generated: ${today}

INSTRUCTIONS:
- Review and edit the draft below
- Copy the content into Beehiiv to send to subscribers
- Nothing has been published automatically

============================================

${digestContent}

============================================
This draft was generated automatically by The Old Oak Weekly content system.
    `;

    await transporter.sendMail({
        from: `"Old Oak Town Content System" <${process.env.SMTP_USER}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `[DRAFT FOR REVIEW] ${subject}`,
        text: emailBody
    });

    console.log('Draft emailed successfully to', process.env.ADMIN_EMAIL);
}

generateDigest().catch(console.error);
