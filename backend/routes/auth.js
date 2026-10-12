const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendRegistrationReviewEmail } = require('../services/emailService');

const APPROVAL_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const buildApprovalUrls = (token) => {
  const baseUrl = (process.env.PUBLIC_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
  return {
    approveUrl: `${baseUrl}/api/auth/approve-registration/${token}`,
    rejectUrl: `${baseUrl}/api/auth/reject-registration/${token}`,
  };
};

const htmlPage = (title, message, isSuccess = true) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f7fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: white; max-width: 480px; width: 100%; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; }
    h1 { color: ${isSuccess ? '#276749' : '#9b2c2c'}; font-size: 22px; margin-bottom: 12px; }
    p { color: #4a5568; font-size: 15px; line-height: 1.5; margin-bottom: 24px; }
    .badge { display: inline-block; padding: 6px 12px; border-radius: 9999px; font-size: 13px; font-weight: bold; background: ${isSuccess ? '#c6f6d5' : '#fed7d7'}; color: ${isSuccess ? '#22543d' : '#742a2a'}; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${isSuccess ? 'Success' : 'Notice'}</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;

const registerAccount = (role) => async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      contactNumber,
      sector,
      departmentName,
      institutionName,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const normalizedSector = sector ? sector.trim() : null;
    if (normalizedSector && !['Govt', 'Private'].includes(normalizedSector)) {
      return res.status(400).json({ message: 'Sector must be either Govt or Private' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.accountStatus === 'pending') {
        return res.status(409).json({
          message: 'A registration for this email is already pending admin approval.',
        });
      }
      if (existing.accountStatus === 'approved') {
        return res.status(400).json({ message: 'An account with this email already exists' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(plainToken);
    const tokenExpires = new Date(Date.now() + APPROVAL_TTL_MS);

    const userFields = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      contactNumber: contactNumber?.trim() || null,
      sector: normalizedSector,
      departmentName: departmentName?.trim() || null,
      institutionName: institutionName?.trim() || null,
      role,
      isAdmin: role === 'team',
      accountStatus: 'pending',
      approvalTokenHash: tokenHash,
      approvalTokenExpires: tokenExpires,
    };

    let user;
    if (existing && existing.accountStatus === 'rejected') {
      user = existing;
      Object.assign(user, userFields);
      await user.save();
    } else {
      user = new User(userFields);
      await user.save();
    }

    const { approveUrl, rejectUrl } = buildApprovalUrls(plainToken);
    const emailResult = await sendRegistrationReviewEmail({
      registrant: user,
      approveUrl,
      rejectUrl,
    });

    res.status(201).json({
      message:
        'Registration submitted. An administrator must approve your account before you can sign in.',
      accountStatus: 'pending',
      role: user.getRole(),
      emailSentToAdmin: emailResult.sent === true,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const processRegistrationDecision = (decision) => async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).send(htmlPage('Invalid Request', 'Missing approval token.', false));
    }

    const user = await User.findOne({
      approvalTokenHash: hashToken(token),
      approvalTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      return res
        .status(400)
        .send(htmlPage('Invalid or Expired Link', 'This approval link is invalid or has expired.', false));
    }

    if (user.accountStatus !== 'pending') {
      return res
        .status(400)
        .send(htmlPage('Already Processed', `This registration was already marked as ${user.accountStatus}.`, false));
    }

    user.accountStatus = decision;
    user.approvalTokenHash = null;
    user.approvalTokenExpires = null;
    await user.save();

    const roleName = user.role === 'team' ? 'Team member' : 'User';
    if (decision === 'approved') {
      return res.send(
        htmlPage(
          'Registration Approved',
          `The ${roleName} account for <strong>${user.name}</strong> (${user.email}) has been approved. They can now log in.`,
          true
        )
      );
    }

    return res.send(
      htmlPage(
        'Registration Rejected',
        `The ${roleName} registration request for <strong>${user.name}</strong> (${user.email}) was rejected.`,
        false
      )
    );
  } catch (error) {
    console.error('Approval decision error:', error);
    res.status(500).send(htmlPage('Error', 'An internal error occurred. Please try again later.', false));
  }
};

const handleLogin = (expectedRole = null) => async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const role = user.getRole();
    if (expectedRole && role !== expectedRole) {
      return res.status(403).json({
        message: `This account is not authorized for the ${expectedRole} portal.`,
      });
    }

    if (user.accountStatus === 'pending') {
      return res.status(403).json({
        message: 'Your account is pending admin approval. You can sign in after approval.',
        accountStatus: 'pending',
      });
    }

    if (user.accountStatus === 'rejected') {
      return res.status(403).json({
        message: 'Your registration was rejected by the administrator.',
        accountStatus: 'rejected',
      });
    }

    const token = jwt.sign(
      { userId: user._id, role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      role,
      isAdmin: user.isAdmin,
      name: user.name,
      message: 'Login successful',
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Registration routes
router.post('/register', registerAccount('user'));
router.post('/register/user', registerAccount('user'));
router.post('/register/team', registerAccount('team'));

// Token approval links from email
router.get('/approve-registration/:token', processRegistrationDecision('approved'));
router.get('/reject-registration/:token', processRegistrationDecision('rejected'));

// Login routes
router.post('/login', handleLogin());
router.post('/login/user', handleLogin('user'));
router.post('/login/team', handleLogin('team'));
router.post('/login/admin', handleLogin('admin'));

module.exports = router;
