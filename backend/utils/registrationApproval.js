const crypto = require('crypto');

const APPROVAL_TTL_MS = 1000 * 60 * 60 * 48; // 48 hours

const generateApprovalToken = () => crypto.randomBytes(32).toString('hex');

const hashApprovalToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const getPublicApiBaseUrl = () => {
  const base = process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 5000}`;
  return base.replace(/\/$/, '');
};

const buildApprovalUrls = (token) => {
  const base = getPublicApiBaseUrl();
  return {
    approveUrl: `${base}/api/auth/approve-registration/${token}`,
    rejectUrl: `${base}/api/auth/reject-registration/${token}`,
  };
};

module.exports = {
  APPROVAL_TTL_MS,
  generateApprovalToken,
  hashApprovalToken,
  buildApprovalUrls,
  getPublicApiBaseUrl,
};
