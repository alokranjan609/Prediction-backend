const APPROVED = 'approved';
const PENDING = 'pending';
const REJECTED = 'rejected';

const normalizeAccountStatus = (user) => {
  if (!user.accountStatus) return APPROVED;
  return user.accountStatus;
};

const loginBlockedMessage = (status) => {
  if (status === PENDING) {
    return 'Your account is pending admin approval. You can sign in after approval.';
  }
  if (status === REJECTED) {
    return 'Your registration was not approved. Contact the administrator if you need access.';
  }
  return 'Account is not allowed to sign in.';
};

const assertCanLogin = (user) => {
  const status = normalizeAccountStatus(user);
  if (status !== APPROVED) {
    const err = new Error(loginBlockedMessage(status));
    err.statusCode = 403;
    err.accountStatus = status;
    throw err;
  }
};

module.exports = {
  APPROVED,
  PENDING,
  REJECTED,
  normalizeAccountStatus,
  loginBlockedMessage,
  assertCanLogin,
};
