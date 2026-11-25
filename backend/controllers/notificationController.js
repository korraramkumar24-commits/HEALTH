import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import asyncHandler from '../utils/asyncHandler.js';

const respond = (res, status, message, data) =>
  res.status(status).json({ success: true, message, data });

export const listNotifications = asyncHandler(async (req, res) => {
  const pageValue = Number(req.query.page);
  const limitValue = Number(req.query.limit);
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const limit = Math.min(50, Number.isSafeInteger(limitValue) && limitValue > 0 ? limitValue : 20);
  const filter = { recipientId: req.user._id };
  const [notifications, totalNotifications, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({
        path: 'alertId',
        select: 'patientId severity status type',
      })
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, readAt: null }),
  ]);
  return respond(res, 200, 'Notifications fetched successfully.', {
    notifications,
    unreadCount,
    page,
    limit,
    totalNotifications,
    totalPages: Math.ceil(totalNotifications / limit),
  });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid notification ID.', data: null });
  }
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipientId: req.user._id, readAt: null },
    { $set: { readAt: new Date() } },
    { returnDocument: 'after' },
  ).lean();

  if (!notification) {
    const exists = await Notification.exists({ _id: req.params.id, recipientId: req.user._id });
    if (!exists) return res.status(404).json({ success: false, message: 'Notification not found.', data: null });
    return respond(res, 200, 'Notification already read.', { notification: null });
  }
  return respond(res, 200, 'Notification marked as read.', { notification });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { recipientId: req.user._id, readAt: null },
    { $set: { readAt: new Date() } },
  );
  return respond(res, 200, 'Notifications marked as read.', { updatedCount: result.modifiedCount });
});
