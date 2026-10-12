import nodemailer from 'nodemailer';
import { Resend } from 'resend';

// Helper to escape HTML and prevent injection in email templates
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Returns the configured recipient email address(es).
 * Defaults to the institution's official email address.
 */
export function getEnquiryRecipient() {
  const recipient = (
    process.env.ENQUIRY_RECIPIENT_EMAIL ||
    process.env.ADMISSION_EMAIL_RECIPIENT ||
    'harsh.singh.2003dydt@gmail.com'
  ).trim();

  return recipient;
}

/**
 * Send an enquiry email using the configured delivery provider (Resend or SMTP).
 * Falls back to a safe mock simulator in test / development mode without crashing.
 */
export async function sendEnquiryEmail(enquiryData) {
  const {
    referenceId,
    name,
    email,
    phone,
    category = 'General Enquiry',
    institutionOrProgramme = '',
    subject,
    message,
    timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  } = enquiryData;

  const recipient = getEnquiryRecipient();
  const emailSubject = `New Website Enquiry — [${category}] — [${name}]`;

  // Sanitized versions for HTML rendering
  const safeRefId = escapeHtml(referenceId || 'N/A');
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone);
  const safeCategory = escapeHtml(category);
  const safeInstProg = escapeHtml(institutionOrProgramme || 'General / Not Specified');
  const safeSubject = escapeHtml(subject || 'General Enquiry');
  const safeMessage = escapeHtml(message || '').replace(/\n/g, '<br>');
  const safeTime = escapeHtml(timestamp);

  // 1. Clean Plain-Text Version
  const textContent = `============================================================
SHOBHA EDUCATION TRUST — NEW WEBSITE ENQUIRY
============================================================

Enquiry Reference ID : ${referenceId}
Sender's Full Name   : ${name}
Sender's Email       : ${email}
Sender's Mobile      : ${phone}
Enquiry Category     : ${category}
Institution / Prog   : ${institutionOrProgramme || 'General / Not Specified'}
Subject              : ${subject}
Submission Date/Time : ${timestamp} IST

------------------------------------------------------------
FULL MESSAGE
------------------------------------------------------------
${message}

------------------------------------------------------------
NOTE: To respond directly to this candidate, reply directly to this email.
The Reply-To address is set to: ${email}
============================================================
Shobha Education Trust • Kamruddinpur, Noorpur, Rampur, Jaunpur, UP
Official Helplines: +91 8318784268 | +91 8765926859
`;

  // 2. High-Performance, Responsive HTML Version
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(emailSubject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F1F5F9; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border: 1px solid #E2E8F0;">
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #0B192C; padding: 24px 30px; text-align: left; border-bottom: 4px solid #FFB703;">
              <div style="color: #FFB703; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">SHOBHA EDUCATION TRUST</div>
              <h1 style="color: #FFFFFF; font-size: 20px; margin: 6px 0 2px; font-weight: 700;">New Website Enquiry</h1>
              <p style="color: #CBD5E1; font-size: 13px; margin: 0;">Sarveshwaree Mahavidyalaya &amp; Affiliated Institutions</p>
            </td>
          </tr>

          <!-- Meta Strip -->
          <tr>
            <td style="background-color: #F8FAFC; padding: 12px 30px; border-bottom: 1px solid #E2E8F0; font-size: 12.5px; color: #64748B;">
              <strong>Reference ID:</strong> <span style="font-family: monospace; font-size: 13px; color: #0B192C; font-weight: 700;">${safeRefId}</span>
              &nbsp;•&nbsp;
              <strong>Submitted:</strong> ${safeTime} IST
            </td>
          </tr>

          <!-- Enquiry Body -->
          <tr>
            <td style="padding: 28px 30px;">
              <h2 style="font-size: 16px; color: #0B192C; margin-top: 0; margin-bottom: 16px; border-bottom: 2px solid #F1F5F9; padding-bottom: 8px;">Sender Information</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px; margin-bottom: 22px;">
                <tr>
                  <td width="160" style="padding: 7px 0; color: #64748B; font-weight: 600;">Full Name:</td>
                  <td style="padding: 7px 0; color: #0B192C; font-weight: 700;">${safeName}</td>
                </tr>
                <tr>
                  <td style="padding: 7px 0; color: #64748B; font-weight: 600;">Email Address:</td>
                  <td style="padding: 7px 0;"><a href="mailto:${safeEmail}" style="color: #1E3E62; text-decoration: none; font-weight: 600;">${safeEmail}</a></td>
                </tr>
                <tr>
                  <td style="padding: 7px 0; color: #64748B; font-weight: 600;">Mobile Number:</td>
                  <td style="padding: 7px 0; color: #0B192C; font-weight: 700;">${safePhone}</td>
                </tr>
                <tr>
                  <td style="padding: 7px 0; color: #64748B; font-weight: 600;">Enquiry Category:</td>
                  <td style="padding: 7px 0;">
                    <span style="background-color: #EFF6FF; color: #1E3E62; font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 4px; border: 1px solid #BFDBFE;">
                      ${safeCategory}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 7px 0; color: #64748B; font-weight: 600;">Institution / Programme:</td>
                  <td style="padding: 7px 0; color: #0B192C;">${safeInstProg}</td>
                </tr>
                <tr>
                  <td style="padding: 7px 0; color: #64748B; font-weight: 600;">Subject:</td>
                  <td style="padding: 7px 0; color: #0B192C; font-weight: 700;">${safeSubject}</td>
                </tr>
              </table>

              <h2 style="font-size: 16px; color: #0B192C; margin-bottom: 10px; border-bottom: 2px solid #F1F5F9; padding-bottom: 8px;">Message Content</h2>
              <div style="background-color: #F8FAFC; border-left: 4px solid #FFB703; padding: 16px 18px; border-radius: 4px; font-size: 14px; line-height: 1.6; color: #334155;">
                ${safeMessage}
              </div>

              <div style="margin-top: 24px; padding: 14px; background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 6px; font-size: 13px; color: #065F46;">
                <strong>Direct Reply Instructions:</strong> You can reply directly to this notification. Your email client will route your reply to <strong>${safeEmail}</strong>.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0F172A; color: #94A3B8; padding: 20px 30px; text-align: center; font-size: 12px; line-height: 1.5;">
              <div style="color: #FFFFFF; font-weight: 600; margin-bottom: 4px;">Shobha Education Trust — Administrative Portal</div>
              <div>Kamruddinpur, Noorpur, Rampur, Jaunpur, Uttar Pradesh — 222203</div>
              <div style="margin-top: 6px; color: #CBD5E1;">Helplines: +91 8318784268 | +91 8765926859</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Test mode mock failure override (for automated test assertions)
  if (process.env.MOCK_EMAIL_FAILURE === 'true') {
    return {
      sent: false,
      provider: 'mock',
      error: 'Simulated email provider network failure'
    };
  }

  // Provider Strategy 1: Resend API
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromAddress = process.env.ENQUIRY_FROM_EMAIL || 'Shobha Education Trust <onboarding@resend.dev>';

      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: recipient,
        reply_to: email,
        subject: emailSubject,
        html: htmlContent,
        text: textContent
      });

      if (error) {
        console.error('[MailService] Resend API error:', error.message || error);
        return {
          sent: false,
          provider: 'resend',
          error: error.message || 'Resend delivery rejection'
        };
      }

      console.log(`[MailService] Enquiry email accepted by Resend for ${recipient}. ID: ${data?.id}`);
      return {
        sent: true,
        provider: 'resend',
        messageId: data?.id,
        recipient
      };
    } catch (err) {
      console.error('[MailService] Resend unexpected error:', err.message);
      return {
        sent: false,
        provider: 'resend',
        error: err.message
      };
    }
  }

  // Provider Strategy 2: SMTP Transport via Nodemailer
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    try {
      const port = parseInt(process.env.SMTP_PORT || '587', 10);
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE === 'true' || port === 465,
        auth: { user, pass }
      });

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || `"Shobha Education Trust" <${user}>`,
        to: recipient,
        replyTo: email,
        subject: emailSubject,
        text: textContent,
        html: htmlContent
      });

      console.log(`[MailService] Enquiry email dispatched via SMTP to ${recipient}. MessageId: ${info.messageId}`);
      return {
        sent: true,
        provider: 'smtp',
        messageId: info.messageId,
        recipient
      };
    } catch (err) {
      console.error('[MailService] SMTP dispatch failure:', err.message);
      return {
        sent: false,
        provider: 'smtp',
        error: err.message
      };
    }
  }

  // Provider Strategy 3: Mock simulator for Development and Automated Testing
  const isTestOrDev = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  if (isTestOrDev) {
    const mockMessageId = `mock_set_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    console.log(`[MailService] Mock accepted enquiry email for ${recipient}. MessageId: ${mockMessageId}`);
    return {
      sent: true,
      provider: 'mock_simulator',
      messageId: mockMessageId,
      recipient
    };
  }

  // If in production without any email provider configured
  console.warn(`[MailService] Production alert: No email provider configured (missing RESEND_API_KEY or SMTP credentials).`);
  return {
    sent: false,
    provider: 'none',
    error: 'No email service provider configured on server.'
  };
}

/**
 * Backward compatibility wrapper for existing routes and tests
 */
export async function sendAdmissionEnquiryEmail(enquiryData) {
  const result = await sendEnquiryEmail({
    referenceId: `LEGACY-${Date.now()}`,
    name: enquiryData.name,
    email: enquiryData.email || 'not-provided@example.com',
    phone: enquiryData.phone,
    category: 'Admissions',
    institutionOrProgramme: enquiryData.programme || 'General Admission',
    subject: enquiryData.emailSubject || `Admission Enquiry from ${enquiryData.name}`,
    message: enquiryData.message || enquiryData.emailBody || 'General Admission Enquiry'
  });

  return {
    sent: result.sent,
    recipient: getEnquiryRecipient(),
    messageId: result.messageId,
    error: result.error
  };
}
