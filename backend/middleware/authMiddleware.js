import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';

const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const [scheme, token, ...extraParts] = authHeader?.split(' ') || [];

  if (scheme !== 'Bearer' || !token || extraParts.length > 0) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided',
      data: null,
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError ||
      error instanceof jwt.NotBeforeError
    ) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        data: null,
      });
    }
    throw error;
  }

  if (!decoded || typeof decoded !== 'object' || !decoded.userId || !decoded.role) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      data: null,
    });
  }

  const user = await User.findById(decoded.userId).select('+tokenVersion');

  if (!user || !user.isActive) {
    return res.status(401).json({
      success: false,
      message: 'User no longer active',
      data: null,
    });
  }
  if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      data: null,
    });
  }

  req.user = user;
  return next();
});

export default protect;
