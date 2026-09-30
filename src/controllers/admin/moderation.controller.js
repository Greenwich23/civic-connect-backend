import mongoose from "mongoose";
import Comment from "../../models/Comments.js";
import Message from "../../models/Message.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";

// @desc   List comments that users have reported
// @route  GET /api/admin/moderation/comments/flagged?page=1&limit=20
export const getFlaggedComments = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);

  const filter = { moderationStatus: "flagged" };

  const [comments, total] = await Promise.all([
    Comment.find(filter)
      .populate("author", "name email")
      .populate("issue", "title")
      .sort({ reportCount: -1, createdAt: -1 }) // most-reported first, for triage
      .skip((page - 1) * limit)
      .limit(limit),
    Comment.countDocuments(filter),
  ]);

  res.json({
    comments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// @desc   Resolve a comment: keep it visible or hide it
// @route  PATCH /api/admin/moderation/comments/:id
// @body   { moderationStatus: "visible" | "hidden" }
export const moderateComment = asyncHandler(async (req, res) => {
  const { moderationStatus } = req.body;

  if (!mongoose.isValidObjectId(req.params.id)) {
    return errorResponse(res, "Invalid comment id", 400);
  }

  if (!["visible", "hidden"].includes(moderationStatus)) {
    return errorResponse(
      res,
      'moderationStatus must be "visible" or "hidden"',
      400,
    );
  }

  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    return errorResponse(res, "Comment not found", 404);
  }

  comment.moderationStatus = moderationStatus;
  await comment.save();

  res.json({
    message: `Comment marked ${moderationStatus}`,
    comment,
  });
});

// @desc   List representative/citizen messages that users have reported
// @route  GET /api/admin/moderation/messages/flagged?page=1&limit=20
export const getFlaggedMessages = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);

  const filter = { moderationStatus: "flagged" };

  const [messages, total] = await Promise.all([
    Message.find(filter)
      .populate("sender", "name email role")
      .populate({
        path: "conversation",
        select: "citizen community",
        populate: [
          { path: "citizen", select: "name email" },
          { path: "community", select: "name" },
        ],
      })
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(limit),
    Message.countDocuments(filter),
  ]);

  res.json({
    messages,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// @desc   Resolve a reported message: keep it visible or hide it
// @route  PATCH /api/admin/moderation/messages/:id
// @body   { moderationStatus: "visible" | "hidden" }
export const moderateMessage = asyncHandler(async (req, res) => {
  const { moderationStatus } = req.body;

  if (!mongoose.isValidObjectId(req.params.id)) {
    return errorResponse(res, "Invalid message id", 400);
  }

  if (!["visible", "hidden"].includes(moderationStatus)) {
    return errorResponse(
      res,
      'moderationStatus must be "visible" or "hidden"',
      400,
    );
  }

  const message = await Message.findById(req.params.id);

  if (!message) {
    return errorResponse(res, "Message not found", 404);
  }

  message.moderationStatus = moderationStatus;
  await message.save();

  res.json({
    message: `Message marked ${moderationStatus}`,
    data: message,
  });
});
