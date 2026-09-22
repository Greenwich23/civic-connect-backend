import Notification from "../../models/Notification.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";

// @desc   Get the logged-in user's notifications
// @route  GET /api/notifications
export const getMyNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ recipient: req.user._id })
    .populate("relatedIssue", "title")
    .sort("-createdAt");

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  res.json({ notifications, unreadCount });
});

// @desc   Mark a single notification as read
// @route  PATCH /api/notifications/:id/read
export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { isRead: true },
    { new: true },
  );

  if (!notification) {
    return errorResponse(res, "Notification not found", 404);
  }

  res.json({ notification });
});

// @desc   Mark all of the logged-in user's notifications as read
// @route  PATCH /api/notifications/read-all
export const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true },
  );

  res.json({ message: "All notifications marked as read" });
});

// @desc   Delete a single notification
// @route  DELETE /api/notifications/:id
export const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    recipient: req.user._id,
  });

  if (!notification) {
    return errorResponse(res, "Notification not found", 404);
  }

  res.json({ message: "Notification deleted" });
});

// @desc   Clear (delete) all of the logged-in user's notifications
// @route  DELETE /api/notifications
export const clearAllNotifications = asyncHandler(async (req, res) => {
  await Notification.deleteMany({ recipient: req.user._id });

  res.json({ message: "All notifications cleared" });
});
