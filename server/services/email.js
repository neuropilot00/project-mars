const nodemailer = require('nodemailer');

let transporter = null;
let smtpConfigured = false;

function initTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.warn('[Email] SMTP not configured — emails will not be sent. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env');
    return;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT, 10),
    secure: parseInt(SMTP_PORT, 10) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  smtpConfigured = true;
  console.log(`[Email] SMTP configured: ${SMTP_HOST}:${SMTP_PORT}`);
}

// Initialize on first require
initTransporter();

/**
 * Send a password reset code email.
 * Returns true if sent, false if SMTP not configured.
 */
async function sendResetCode(email, code) {
  if (!smtpConfigured || !transporter) {
    console.warn(`[Email] SMTP not configured — reset code for ${email} not sent`);
    return false;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#e85d04,#ff6b35);padding:28px 32px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:24px;letter-spacing:2px;">OCCUPY MARS</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="color:#ccc;font-size:15px;margin:0 0 24px;">You requested a password reset. Use the code below to verify your identity:</p>
            <div style="background:#0d0d1a;border:1px solid #333;border-radius:8px;padding:24px;text-align:center;margin:0 0 24px;">
              <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#ff6b35;">${code}</span>
            </div>
            <p style="color:#999;font-size:13px;margin:0 0 8px;">This code expires in <strong style="color:#ccc;">10 minutes</strong>.</p>
            <p style="color:#999;font-size:13px;margin:0;">If you did not request this, you can safely ignore this email.</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #2a2a3e;text-align:center;">
            <p style="color:#555;font-size:11px;margin:0;">OCCUPY MARS &mdash; Pixel War</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from,
      to: email,
      subject: 'OCCUPY MARS — Password Reset Code',
      html
    });
    console.log(`[Email] Reset code sent to ${email}`);
    return true;
  } catch (e) {
    console.error(`[Email] Failed to send reset code to ${email}:`, e.message);
    return false;
  }
}

function isSmtpConfigured() {
  return smtpConfigured;
}

module.exports = { sendResetCode, isSmtpConfigured };
