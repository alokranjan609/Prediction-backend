const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    req.userRole = user.getRole();
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const isAdmin = (user) => {
  if (!user) return false;
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL;
  return user.getRole() === 'admin' || (adminEmail && user.email === adminEmail);
};

const isTeam = (user) => {
  if (!user) return false;
  return isAdmin(user) || user.getRole() === 'team' || user.isAdmin === true;
};

// Middleware: Requires a Team member or Admin.
const verifyTeam = [
  authenticate,
  (req, res, next) => {
    if (!isTeam(req.user)) {
      return res.status(403).json({ message: 'Access denied: Team privileges required' });
    }
    next();
  }
];

// Middleware: Requires an Admin.
const verifyAdmin = [
  authenticate,
  (req, res, next) => {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ message: 'Access denied: Admin privileges required' });
    }
    next();
  }
];

const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (!roles.includes(req.userRole) && !isAdmin(req.user)) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }

  next();
};

module.exports = {
  authenticate,
  verifyTeam,
  verifyAdmin,
  requireRoles,
  isTeam,
  isAdmin,
  // Backwards-compatible aliases for clients importing the old names.
  verifySuperAdmin: verifyAdmin,
  isSuperAdmin: isAdmin
};
