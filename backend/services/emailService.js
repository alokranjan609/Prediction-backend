const nodemailer = require('nodemailer');

let transporter;

const isEmailConfigured = () =>
  Boolean(
    (process.env.SMTP_SERVICE || process.env.SMTP_HOST) &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM
  );

const getTransporter = () => {
  if (!isEmailConfigured()) return null;
  if (!transporter) {
    const transportConfig = {
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

    if (process.env.SMTP_SERVICE) {
      transportConfig.service = process.env.SMTP_SERVICE;
    } else {
      transportConfig.host = process.env.SMTP_HOST;
      transportConfig.port = Number(process.env.SMTP_PORT || 587);
      transportConfig.secure =
        process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465';
    }

    transporter = nodemailer.createTransport(transportConfig);
  }
  return transporter;
};

const getAdminNotificationEmail = () =>
  process.env.ADMIN_NOTIFICATION_EMAIL ||
  process.env.ADMIN_EMAIL ||
  process.env.SUPER_ADMIN_EMAIL;

const sendMail = async ({ to, subject, text, html }) => {
  const mailTransport = getTransporter();
  if (!mailTransport) {
    console.warn('[email] SMTP not configured. Email not sent.');
    console.warn('[email]', { to, subject, text });
    return { sent: false, reason: 'smtp_not_configured' };
  }

  try {
    const info = await mailTransport.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text,
      html,
    });
    return { sent: true, messageId: info?.messageId };
  } catch (error) {
    console.error('[email] Error sending email:', error.message);
    return { sent: false, reason: error.message };
  }
};

const sendRegistrationReviewEmail = async ({ registrant, approveUrl, rejectUrl }) => {
  const adminTo = getAdminNotificationEmail();
  if (!adminTo) {
    console.warn('[email] No ADMIN_NOTIFICATION_EMAIL / ADMIN_EMAIL set.');
    console.warn('[email] Approve:', approveUrl);
    console.warn('[email] Reject:', rejectUrl);
    return { sent: false, reason: 'admin_email_missing' };
  }

  const roleLabel = registrant.role === 'team' ? 'Team Member' : 'Regular User';
  const subject = `[RoboFly] Registration Approval Request: ${registrant.name} (${roleLabel})`;

  const contactDisplay = registrant.contactNumber || 'Not provided';
  const sectorDisplay = registrant.sector || 'Not provided';
  const deptDisplay = registrant.departmentName || 'Not provided';
  const instDisplay = registrant.institutionName || 'Not provided';
  const submittedAt = new Date().toLocaleString('en-US', { timeZoneName: 'short' });

  const textLines = [
    `=== NEW REGISTRATION APPROVAL REQUEST ===`,
    ``,
    `Account Role:      ${roleLabel}`,
    `Full Name:         ${registrant.name}`,
    `Email:             ${registrant.email}`,
    `Contact Number:    ${contactDisplay}`,
    `Sector:            ${sectorDisplay}`,
    `Department Name:   ${deptDisplay}`,
    `Institution Name:  ${instDisplay}`,
    `Registered At:     ${submittedAt}`,
    ``,
    `--- ACTION LINKS ---`,
    `Approve Registration:`,
    `${approveUrl}`,
    ``,
    `Reject Registration:`,
    `${rejectUrl}`,
    ``,
    `Note: Links expire in 48 hours.`,
  ];
  const text = textLines.join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #1a365d; border-bottom: 2px solid #2b6cb0; padding-bottom: 8px;">
        New Registration Approval Request
      </h2>
      <p style="color: #4a5568;">
        A new account has registered on <strong>RoboFly</strong> and is waiting for your review. Below is the complete applicant information:
      </p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
        <tr style="background-color: #f7fafc;">
          <td style="padding: 10px; font-weight: bold; width: 35%; border-bottom: 1px solid #edf2f7;">Role:</td>
          <td style="padding: 10px; border-bottom: 1px solid #edf2f7;"><span style="background-color: #ebf8ff; color: #2b6cb0; padding: 3px 8px; border-radius: 4px; font-weight: bold;">${roleLabel}</span></td>
        </tr>
        <tr>
          <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #edf2f7;">Full Name:</td>
          <td style="padding: 10px; border-bottom: 1px solid #edf2f7;">${registrant.name}</td>
        </tr>
        <tr style="background-color: #f7fafc;">
          <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #edf2f7;">Email Address:</td>
          <td style="padding: 10px; border-bottom: 1px solid #edf2f7;"><a href="mailto:${registrant.email}">${registrant.email}</a></td>
        </tr>
        <tr>
          <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #edf2f7;">Contact Number:</td>
          <td style="padding: 10px; border-bottom: 1px solid #edf2f7;">${contactDisplay}</td>
        </tr>
        <tr style="background-color: #f7fafc;">
          <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #edf2f7;">Sector:</td>
          <td style="padding: 10px; border-bottom: 1px solid #edf2f7;">${sectorDisplay}</td>
        </tr>
        <tr>
          <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #edf2f7;">Department:</td>
          <td style="padding: 10px; border-bottom: 1px solid #edf2f7;">${deptDisplay}</td>
        </tr>
        <tr style="background-color: #f7fafc;">
          <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #edf2f7;">Institution:</td>
          <td style="padding: 10px; border-bottom: 1px solid #edf2f7;">${instDisplay}</td>
        </tr>
        <tr>
          <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #edf2f7;">Submitted At:</td>
          <td style="padding: 10px; border-bottom: 1px solid #edf2f7;">${submittedAt}</td>
        </tr>
      </table>

      <div style="margin: 25px 0; text-align: center;">
        <a href="${approveUrl}" style="background-color: #38a169; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-right: 15px;">
          ✓ Approve Account
        </a>
        <a href="${rejectUrl}" style="background-color: #e53e3e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          ✕ Reject Request
        </a>
      </div>

      <p style="font-size: 12px; color: #a0aec0; border-top: 1px solid #edf2f7; padding-top: 15px; margin-top: 25px;">
        These links are valid for 48 hours. If the buttons above do not work, you can paste the URLs into your browser:
        <br/>Approve: <code>${approveUrl}</code>
        <br/>Reject: <code>${rejectUrl}</code>
      </p>
    </div>
  `;

  return sendMail({ to: adminTo, subject, text, html });
};

module.exports = {
  sendMail,
  sendRegistrationReviewEmail,
};
