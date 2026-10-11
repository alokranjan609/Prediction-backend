const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendRegistrationReviewEmail } = require('../services/emailService');
const {
  APPROVAL_TTL_MS,
  generateApprovalToken,
  hashApprovalToken,
  buildApprovalUrls,
} = require('../utils/registrationApproval');
const {
  APPROVED,
  PENDING,
  REJECTED,
  assertCanLogin,
} = require('../utils/accountAccess');

const PORTAL_DENIED = {
  user: 'This account is not a regular user. Use the team or admin sign-in page.',
  team: 'This account is not a team member. Use the correct portal to sign in.',
  admin: 'This account is not an administrator. Use the correct portal to sign in.',
};

const htmlPage = (title, body) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${title}</title></head>
<body style="font-family:sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;">
<h1>${title}</h1>
<p>${body}</p>
</body></html>`;

const issueAuthResponse = (user, res) => {
  assertCanLogin(user);
  const role = user.getRole();
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
};

const loginForPortal = (expectedRole) => async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const role = user.getRole();
    if (role !== expectedRole) {
      return res.status(403).json({ message: PORTAL_DENIED[expectedRole] });
    }

    assertCanLogin(user);
    issueAuthResponse(user, res);
  } catch (error) {
    if (error.statusCode === 403) {
      return res.status(403).json({
        message: error.message,
        accountStatus: error.accountStatus,
      });
    }
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

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

    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.accountStatus === PENDING) {
        return res.status(409).json({
          message: 'A registration for this email is already pending admin approval.',
        });
      }
      if (existing.accountStatus === APPROVED) {
        return res.status(400).json({ message: 'An account with this email already exists' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const plainToken = generateApprovalToken();
    const tokenHash = hashApprovalToken(plainToken);
    const tokenExpires = new Date(Date.now() + APPROVAL_TTL_MS);

    const userFields = {
      name,
      email,
      password: hashedPassword,
      contactNumber: contactNumber?.trim() || null,
      departmentName: departmentName?.trim() || null,
      institutionName: institutionName?.trim() || null,
      role,
      isAdmin: role === 'team',
      accountStatus: PENDING,
      approvalTokenHash: tokenHash,
      approvalTokenExpires: tokenExpires,
    };

    if (sector && ['Govt', 'Private'].includes(sector.trim())) {
      userFields.sector = sector.trim();
    }

    let user;
    if (existing && existing.accountStatus === REJECTED) {
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
      accountStatus: PENDING,
      role: user.getRole(),
      emailSentToAdmin: emailResult.sent === true,
      ...(emailResult.sent !== true && process.env.NODE_ENV !== 'production'
        ? { devApprovalLinks: { approveUrl, rejectUrl } }
        : {}),
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
      return res.status(400).send(htmlPage('Invalid link', 'Missing approval token.'));
    }

    const user = await User.findOne({
      approvalTokenHash: hashApprovalToken(token),
      approvalTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      return res
        .status(400)
        .send(htmlPage('Invalid or expired link', 'This approval link is invalid or has expired.'));
    }

    if (user.accountStatus !== PENDING) {
      return res
        .status(400)
        .send(htmlPage('Already processed', 'This registration was already reviewed.'));
    }

    user.accountStatus = decision;
    user.approvalTokenHash = null;
    user.approvalTokenExpires = null;
    await user.save();

    if (decision === APPROVED) {
      return res.send(
        htmlPage(
          'Registration approved',
          `${user.name} (${user.email}) can now sign in with the password they chose during registration.`
        )
      );
    }

    return res.send(
      htmlPage(
        'Registration rejected',
        `The registration for ${user.name} (${user.email}) was rejected.`
      )
    );
  } catch (error) {
    console.error('Approval decision error:', error);
    res.status(500).send(htmlPage('Error', 'Something went wrong. Please try again later.'));
  }
};

// User self-registration (basic fields only; optional org fields removed from this flow).
router.post('/register/user', registerAccount('user'));
router.post('/register/team', registerAccount('team'));
router.post('/register', registerAccount('user'));

router.get('/approve-registration/:token', processRegistrationDecision(APPROVED));
router.get('/reject-registration/:token', processRegistrationDecision(REJECTED));

router.post('/login/user', loginForPortal('user'));
router.post('/login/team', loginForPortal('team'));
router.post('/login/admin', loginForPortal('admin'));

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    assertCanLogin(user);

    const role = user.getRole();
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
    if (error.statusCode === 403) {
      return res.status(403).json({
        message: error.message,
        accountStatus: error.accountStatus,
      });
    }
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
