import express from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, getProfile, changePassword } from '../controllers/authController.js';
import protect from '../middleware/authMiddleware.js';
import {
  changePasswordRules,
  loginRules,
  registerRules,
  validateRequest,
} from '../middleware/validate.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many auth requests, please try again later.',
    data: null,
  },
});

router.post('/register', authLimiter, registerRules, validateRequest, register);
router.post('/login', authLimiter, loginRules, validateRequest, login);
router.get('/profile', protect, getProfile);
router.put('/change-password', protect, changePasswordRules, validateRequest, changePassword);

export default router;
