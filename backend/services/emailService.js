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

  const roleLabel = registrant.role === 'team' ? 'Team' : 'User';
  const subject = `[RoboFly] New ${roleLabel} registration — ${registrant.name}`;

  const optionalText = [
    registrant.contactNumber ? `Contact: ${registrant.contactNumber}` : null,
    registrant.sector ? `Sector: ${registrant.sector}` : null,
    registrant.departmentName ? `Department: ${registrant.departmentName}` : null,
    registrant.institutionName ? `Institution: ${registrant.institutionName}` : null,
  ].filter(Boolean);

  const text = [
    `A new ${roleLabel.toLowerCase()} registration is waiting for your approval.`,
    '',
    `Name: ${registrant.name}`,
    `Email: ${registrant.email}`,
    ...optionalText,
    '',
    `Approve: ${approveUrl}`,
    `Reject: ${rejectUrl}`,
  ].join('\n');

  const optionalHtml = [
    registrant.contactNumber ? `<li><strong>Contact:</strong> ${registrant.contactNumber}</li>` : '',
    registrant.sector ? `<li><strong>Sector:</strong> ${registrant.sector}</li>` : '',
    registrant.departmentName ? `<li><strong>Department:</strong> ${registrant.departmentName}</li>` : '',
    registrant.institutionName ? `<li><strong>Institution:</strong> ${registrant.institutionName}</li>` : '',
  ].filter(Boolean).join('');

  const html = `
    <p>A new <strong>${roleLabel}</strong> registration is waiting for your approval.</p>
    <ul>
      <li><strong>Name:</strong> ${registrant.name}</li>
      <li><strong>Email:</strong> ${registrant.email}</li>
      ${optionalHtml}
    </ul>
    <p>
      <a href="${approveUrl}">Approve registration</a><br/>
      <a href="${rejectUrl}">Reject registration</a>
    </p>
  `;

  return sendMail({ to: adminTo, subject, text, html });
};

module.exports = {
  isEmailConfigured,
  sendMail,
  sendRegistrationReviewEmail,
};
