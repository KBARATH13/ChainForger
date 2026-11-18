const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable must be configured.');
}

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Provide a valid Bearer token.'
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }

  if (!decoded || typeof decoded !== 'object' || !decoded.id ||
      !['admin', 'developer', 'auditor'].includes(decoded.role) ||
      typeof decoded.companyName !== 'string' || !decoded.companyName) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }

  req.user = {
    id: String(decoded.id),
    role: decoded.role,
    companyName: decoded.companyName,
    walletAddress: decoded.walletAddress
  };
  req.authMethod = 'jwt';
  return next();
};

const requireRole = (...allowed) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthenticated' });
    }

    if (allowed.length > 0 && !allowed.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: role "${req.user.role}" does not have required privileges.`
      });
    }

    return next();
  };
};

module.exports = {
  authenticate,
  requireRole,
  JWT_SECRET
};
