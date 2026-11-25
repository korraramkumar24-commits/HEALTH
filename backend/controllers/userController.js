import User from '../models/User.js';
import Patient from '../models/Patient.js';
import asyncHandler from '../utils/asyncHandler.js';

const respond = (res, status, message, data) =>
  res.status(status).json({ success: true, message, data });
const userProjection = 'name email phone role isActive createdAt';

export const listUsers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role && !['patient', 'doctor', 'admin'].includes(req.query.role)) {
    return res.status(400).json({ success: false, message: 'Invalid user role filter.', data: null });
  }
  if (req.query.role) {
    filter.role = req.query.role;
  }
  const search = String(req.query.search || '').trim();
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: new RegExp(escaped, 'i') },
      { email: new RegExp(escaped, 'i') },
    ];
  }
  const users = await User.find(filter).select(userProjection).sort({ createdAt: -1 }).lean();
  return respond(res, 200, 'Users fetched successfully.', { users });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.', data: null });
  }
  const { name, email, phone, isActive } = req.body;
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isActive must be a boolean.', data: null });
  }
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (phone !== undefined) user.phone = phone;
  if (isActive !== undefined) user.isActive = isActive;
  await user.save();
  return respond(res, 200, 'User updated successfully.', {
    user: await User.findById(user._id).select(userProjection).lean(),
  });
});

export const deleteUser = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) {
    return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.', data: null });
  }
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { $set: { isActive: false } },
    { returnDocument: 'after' },
  ).select(userProjection).lean();
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.', data: null });
  }
  if (user.role === 'patient') {
    await Patient.findOneAndUpdate({ userId: user._id }, { $set: { status: 'inactive' } });
  }
  return respond(res, 200, 'User deactivated successfully.', { user });
});
