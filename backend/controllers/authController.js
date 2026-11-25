import User from '../models/User.js';
import Patient from '../models/Patient.js';
import generateToken from '../utils/generateToken.js';
import asyncHandler from '../utils/asyncHandler.js';
import writeAuditLog from '../utils/writeAuditLog.js';

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  isActive: user.isActive,
  createdAt: user.createdAt,
});

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = await User.create({
    name,
    email: normalizedEmail,
    password,
    phone,
    role: 'patient',
  });

  try {
    await Patient.create({ userId: user._id });
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    throw error;
  }

  const token = generateToken(user._id, user.role);
  await writeAuditLog({
    actorId: user._id,
    action: 'auth.register',
    resourceType: 'auth',
    resourceId: user._id,
    ip: req.ip,
  });

  return res.status(201).json({
    success: true,
    message: 'Patient registered successfully',
    data: {
      user: sanitizeUser(user),
      token,
    },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail }).select('+password +tokenVersion');

  if (!user || !user.isActive || !(await user.comparePassword(password))) {
    await writeAuditLog({
      actorId: user?._id || null,
      action: 'auth.login.failure',
      resourceType: 'auth',
      resourceId: user?._id || null,
      ip: req.ip,
    });
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
      data: null,
    });
  }

  await writeAuditLog({
    actorId: user._id,
    action: 'auth.login.success',
    resourceType: 'auth',
    resourceId: user._id,
    ip: req.ip,
  });
  const token = generateToken(user._id, user.role, user.tokenVersion);

  return res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: sanitizeUser(user),
      token,
    },
  });
});

export const getProfile = asyncHandler(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Profile fetched successfully',
    data: {
      user: sanitizeUser(req.user),
    },
  });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
      data: null,
    });
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect',
      data: null,
    });
  }

  user.password = newPassword;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  return res.status(200).json({
    success: true,
    message: 'Password updated successfully',
    data: null,
  });
});
