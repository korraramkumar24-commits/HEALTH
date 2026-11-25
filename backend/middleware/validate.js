import { body, validationResult } from 'express-validator';

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const message = errors.array()[0].msg;

    return res.status(400).json({
      success: false,
      message,
      data: null,
    });
  }

  next();
};

const passwordRules = (field, label) =>
  body(field)
    .isLength({ min: 8 })
    .withMessage(`${label} must be at least 8 characters long`)
    .matches(/[A-Za-z]/)
    .withMessage(`${label} must contain at least one letter`)
    .matches(/[0-9]/)
    .withMessage(`${label} must contain at least one number`);

export const registerRules = [
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('email').trim().isEmail().withMessage('Please provide a valid email address'),
  passwordRules('password', 'Password'),
  body('phone').optional().trim().isLength({ max: 30 }).withMessage('Phone is too long'),
];

export const loginRules = [
  body('email').trim().isEmail().withMessage('Please provide a valid email address'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  passwordRules('newPassword', 'New password'),
];
