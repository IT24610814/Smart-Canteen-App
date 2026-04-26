const jwt = require('jsonwebtoken');
const config = require('../config/config');

// Verify JWT Token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    return null;
  }
};

// Generate JWT Token
const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, config.jwt.secret, {
    expiresIn: config.jwt.expireIn
  });
};

// Middleware: Protect Routes
const auth = (req, res, next) => {
  try {
    const headerAuth = req.headers.authorization;
    
    if (!headerAuth) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = headerAuth.split(' ')[1]; // Bearer token
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    req.user = {
      ...decoded,
      id: decoded.userId
    };
    next();
  } catch (error) {
    res.status(500).json({ message: 'Authentication error', error: error.message });
  }
};

// Middleware: Role-based Access Control
const roleAccess = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};

module.exports = {
  auth,
  roleAccess,
  generateToken,
  verifyToken
};
