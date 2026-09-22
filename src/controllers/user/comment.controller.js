import Comment from "../../models/Comments.js";
import Issue from "../../models/Issues.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";
import {
  notifyIssueFollowers,
  notifyUser,
  notifyManyUsers,
} from "../../utils/notify.js";

/**
 * =========================================================
 * CREATE / POST COMMENT
 * POST /api/issues/:issueId/comments
 * =========================================================
 */
export const createComment = asyncHandler(async (req, res) => {
  const { issueId } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return errorResponse(res, "Comment content is required", 400);
  }

  if (!req.user.community) {
    return errorResponse(
      res,
      "You need to join a community before commenting",
      400,
    );
  }

  const issue = await Issue.findById(issueId);

  if (!issue) {
    return errorResponse(res, "Issue not found", 404);
  }

  /*
    Make sure the user belongs to the same community
    as the issue.
  */
  if (issue.community.toString() !== req.user.community.toString()) {
    return errorResponse(
      res,
      "You can only comment on issues in your community",
      403,
    );
  }

  const comment = await Comment.create({
    issue: issueId,
    author: req.user._id,
    community: req.user.community,
    content: content.trim(),
  });

  await comment.populate([
    {
      path: "author",
      select: "name avatarUrl role",
    },
    {
      path: "community",
      select: "name city state",
    },
  ]);

  if (issue.reportedBy.toString() !== req.user._id.toString()) {
    await notifyUser({
      recipient: issue.reportedBy,
      type: "new_comment",
      message: `${req.user.name} commented on your issue "${issue.title}"`,
      relatedIssue: issue._id,
    });
  }

  await notifyIssueFollowers({
    issue,
    type: "new_comment",
    message: `New comment on "${issue.title}"`,
    excludeUserId: req.user._id,
  });

  res.status(201).json({
    message: "Comment posted successfully",
    comment,
  });
});

/**
 * =========================================================
 * GET ALL COMMENTS FOR AN ISSUE
 * GET /api/issues/:issueId/comments
 * =========================================================
 */
export const getIssueComments = asyncHandler(async (req, res) => {
  const { issueId } = req.params;

  const issue = await Issue.findById(issueId).select("_id");

  if (!issue) {
    return errorResponse(res, "Issue not found", 404);
  }

  const comments = await Comment.find({
    issue: issueId,
    parentComment: null, // ← only top-level comments; replies come from getCommentReplies
    moderationStatus: "visible",
  })
    .populate({
      path: "author",
      select: "name avatarUrl role",
    })
    .sort({ createdAt: 1 });

  res.status(200).json({
    comments,
  });
});

/**
 * =========================================================
 * GET SINGLE COMMENT
 * GET /api/comments/:commentId
 * =========================================================
 */
export const getCommentById = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const comment = await Comment.findOne({
    _id: commentId,
    moderationStatus: "visible",
  }).populate({
    path: "author",
    select: "name avatarUrl role",
  });

  if (!comment) {
    return errorResponse(res, "Comment not found", 404);
  }

  res.status(200).json({
    comment,
  });
});

/**
 * =========================================================
 * REPLY TO COMMENT
 * POST /api/comments/:commentId/replies
 * =========================================================
 */
export const replyToComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return errorResponse(res, "Reply content is required", 400);
  }

  const parentComment = await Comment.findOne({
    _id: commentId,
    moderationStatus: "visible",
  });

  if (!parentComment) {
    return errorResponse(res, "Comment not found", 404);
  }

  /*
    Make sure the issue still exists.
  */
  const issue = await Issue.findById(parentComment.issue);

  if (!issue) {
    return errorResponse(res, "Issue not found", 404);
  }

  const reply = await Comment.create({
    issue: parentComment.issue,
    author: req.user._id,
    content: content.trim(),
    parentComment: parentComment._id,
  });

  await reply.populate({
    path: "author",
    select: "name avatarUrl role",
  });

  res.status(201).json({
    message: "Reply posted successfully",
    comment: reply,
  });
});

/**
 * =========================================================
 * GET REPLIES FOR A COMMENT
 * GET /api/comments/:commentId/replies
 * =========================================================
 */
export const getCommentReplies = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const parentComment = await Comment.findOne({
    _id: commentId,
    moderationStatus: "visible",
  });

  if (!parentComment) {
    return errorResponse(res, "Comment not found", 404);
  }

  const replies = await Comment.find({
    parentComment: commentId,
    moderationStatus: "visible",
  })
    .populate({
      path: "author",
      select: "name avatarUrl role",
    })
    .sort({ createdAt: 1 });

  res.status(200).json({
    replies,
  });
});

/**
 * =========================================================
 * UPDATE COMMENT
 * PUT /api/comments/:commentId
 * =========================================================
 */
export const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return errorResponse(res, "Comment content is required", 400);
  }

  const comment = await Comment.findOne({
    _id: commentId,
    moderationStatus: "visible",
  });

  if (!comment) {
    return errorResponse(res, "Comment not found", 404);
  }

  /*
    Only the person who created the comment
    can edit it.
  */
  if (comment.author.toString() !== req.user._id.toString()) {
    return errorResponse(res, "You can only edit your own comment", 403);
  }

  comment.content = content.trim();

  await comment.save();

  await comment.populate({
    path: "author",
    select: "name avatarUrl role",
  });

  res.status(200).json({
    message: "Comment updated successfully",
    comment,
  });
});

/**
 * =========================================================
 * DELETE COMMENT
 * DELETE /api/comments/:commentId
 * =========================================================
 */
export const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const comment = await Comment.findById(commentId);

  if (!comment) {
    return errorResponse(res, "Comment not found", 404);
  }

  const isOwner = comment.author.toString() === req.user._id.toString();

  const isAdmin = req.user.role === "admin";

  /*
    Only the comment owner or admin can delete it.
  */
  if (!isOwner && !isAdmin) {
    return errorResponse(
      res,
      "You are not allowed to delete this comment",
      403,
    );
  }

  /*
    We don't actually remove the comment.

    Instead we hide it through moderationStatus.
    This is useful because replies may already exist.
  */
  comment.moderationStatus = "hidden";

  await comment.save();

  res.status(200).json({
    message: "Comment deleted successfully",
  });
});

/**
 * =========================================================
 * REPORT / FLAG COMMENT
 * POST /api/comments/:commentId/report
 * =========================================================
 */
export const reportComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const comment = await Comment.findOne({
    _id: commentId,
    moderationStatus: "visible",
  });

  if (!comment) {
    return errorResponse(res, "Comment not found", 404);
  }

  comment.moderationStatus = "flagged";

  await comment.save();

  res.status(200).json({
    message: "Comment reported successfully",
  });
});
