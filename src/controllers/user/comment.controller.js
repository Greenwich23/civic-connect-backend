import Comment from "../../models/Comments.js";
import Issue from "../../models/Issues.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";
import {
  notifyIssueFollowers,
  notifyUser,
  notifyManyUsers,
} from "../../utils/notify.js";

// Replaces the raw likes array (user ids) with what the UI needs: a total
// and whether the current user has liked it.
const withLikeInfo = (comment, userId) => {
  const obj = comment.toObject ? comment.toObject() : comment;
  const { likes = [], ...rest } = obj;

  return {
    ...rest,
    likeCount: likes.length,
    likedByMe: likes.some((id) => id.toString() === userId.toString()),
  };
};

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
      select: "name avatarUrl role representativeInfo.isVerifiedOfficial",
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
    moderationStatus: { $ne: "hidden" }, // a flagged-but-not-hidden comment stays fully visible/interactable
  })
    .populate({
      path: "author",
      select: "name avatarUrl role representativeInfo.isVerifiedOfficial",
    })
    .sort({ isPinned: -1, createdAt: 1 }); // pinned announcement (if any) floats to the top

  res.status(200).json({
    comments: comments.map((c) => withLikeInfo(c, req.user._id)),
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
    moderationStatus: { $ne: "hidden" }, // a flagged-but-not-hidden comment stays fully visible/interactable
  }).populate({
    path: "author",
    select: "name avatarUrl role representativeInfo.isVerifiedOfficial",
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
    moderationStatus: { $ne: "hidden" }, // a flagged-but-not-hidden comment stays fully visible/interactable
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
    select: "name avatarUrl role representativeInfo.isVerifiedOfficial",
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
    moderationStatus: { $ne: "hidden" }, // a flagged-but-not-hidden comment stays fully visible/interactable
  });

  if (!parentComment) {
    return errorResponse(res, "Comment not found", 404);
  }

  const replies = await Comment.find({
    parentComment: commentId,
    moderationStatus: { $ne: "hidden" }, // a flagged-but-not-hidden comment stays fully visible/interactable
  })
    .populate({
      path: "author",
      select: "name avatarUrl role representativeInfo.isVerifiedOfficial",
    })
    .sort({ createdAt: 1 });

  // Each reply needs its own child-reply count so the frontend knows
  // whether to show a "View replies" toggle for it — without this, nested
  // replies always look like dead ends even when they have their own replies.
  const repliesWithCounts = await Promise.all(
    replies.map(async (reply) => {
      const replyCount = await Comment.countDocuments({
        parentComment: reply._id,
        moderationStatus: { $ne: "hidden" },
      });

      return { ...withLikeInfo(reply, req.user._id), replyCount };
    }),
  );

  res.status(200).json({
    replies: repliesWithCounts,
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
    moderationStatus: { $ne: "hidden" }, // a flagged-but-not-hidden comment stays fully visible/interactable
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
    select: "name avatarUrl role representativeInfo.isVerifiedOfficial",
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
 *
 * Reporting flags a comment for the admin moderation queue — it does NOT
 * hide it. A single report (or a handful of bad-faith ones) can't make a
 * comment disappear for the community; only an admin choosing to hide it
 * can. reportCount lets admins triage by how many people reported the same
 * comment, without that count ever hiding anything by itself.
 * =========================================================
 */
const REPORT_REASONS = Comment.schema.path("reportReason").enumValues;

export const reportComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { reason, details } = req.body;

  if (!REPORT_REASONS.includes(reason)) {
    return errorResponse(
      res,
      `reason must be one of: ${REPORT_REASONS.join(", ")}`,
      400,
    );
  }

  const comment = await Comment.findOne({
    _id: commentId,
    moderationStatus: { $ne: "hidden" },
  });

  if (!comment) {
    return errorResponse(res, "Comment not found", 404);
  }

  const alreadyReported = comment.reportedBy.some(
    (userId) => userId.toString() === req.user._id.toString(),
  );

  if (alreadyReported) {
    return errorResponse(res, "You've already reported this comment", 400);
  }

  // Flags it for the admin queue — content stays visible to everyone
  comment.moderationStatus = "flagged";
  comment.reportReason = reason; // most recent report's context
  comment.reportDetails = details?.trim() || undefined;
  comment.reportedBy.push(req.user._id);
  comment.reportCount = comment.reportedBy.length;

  await comment.save();

  res.status(200).json({
    message: "Comment reported successfully",
  });
});

/**
 * =========================================================
 * PIN COMMENT
 * POST /api/comments/:commentId/pin
 *
 * Lets the active representative of a community pin one of their own
 * top-level comments on an issue — used to post announcements. Only one
 * comment can be pinned per issue at a time; pinning a new one unpins
 * whichever was pinned before it.
 * =========================================================
 */
export const pinComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const comment = await Comment.findOne({
    _id: commentId,
    moderationStatus: { $ne: "hidden" }, // a flagged-but-not-hidden comment stays fully visible/interactable
  });

  if (!comment) {
    return errorResponse(res, "Comment not found", 404);
  }

  if (comment.parentComment) {
    return errorResponse(res, "Only top-level comments can be pinned", 400);
  }

  if (comment.author.toString() !== req.user._id.toString()) {
    return errorResponse(res, "You can only pin your own comments", 403);
  }

  const isActiveRepForThisCommunity =
    req.user.role === "representative" &&
    req.user.representativeInfo?.isActive &&
    req.user.representativeInfo?.community?.toString() ===
      comment.community.toString();

  if (!isActiveRepForThisCommunity) {
    return errorResponse(
      res,
      "Only the active representative for this community can pin comments",
      403,
    );
  }

  // Enforce a single pinned comment per issue
  await Comment.updateMany(
    { issue: comment.issue, isPinned: true, _id: { $ne: comment._id } },
    { $set: { isPinned: false, pinnedAt: null } },
  );

  comment.isPinned = true;
  comment.pinnedAt = new Date();
  await comment.save();

  await comment.populate({
    path: "author",
    select: "name avatarUrl role representativeInfo.isVerifiedOfficial",
  });

  res.status(200).json({
    message: "Comment pinned",
    comment,
  });
});

/**
 * =========================================================
 * UNPIN COMMENT
 * DELETE /api/comments/:commentId/pin
 * =========================================================
 */
export const unpinComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const comment = await Comment.findOne({
    _id: commentId,
    moderationStatus: { $ne: "hidden" }, // a flagged-but-not-hidden comment stays fully visible/interactable
  });

  if (!comment) {
    return errorResponse(res, "Comment not found", 404);
  }

  if (comment.author.toString() !== req.user._id.toString()) {
    return errorResponse(res, "You can only unpin your own comments", 403);
  }

  comment.isPinned = false;
  comment.pinnedAt = null;
  await comment.save();

  await comment.populate({
    path: "author",
    select: "name avatarUrl role representativeInfo.isVerifiedOfficial",
  });

  res.status(200).json({
    message: "Comment unpinned",
    comment,
  });
});

/**
 * =========================================================
 * TOGGLE LIKE ON A COMMENT
 * POST /api/comments/:commentId/like
 *
 * Likes the comment if the user hasn't yet, otherwise removes their like.
 * =========================================================
 */
export const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const comment = await Comment.findOne({
    _id: commentId,
    moderationStatus: { $ne: "hidden" },
  }).select("likes");

  if (!comment) {
    return errorResponse(res, "Comment not found", 404);
  }

  const alreadyLiked = comment.likes.some(
    (id) => id.toString() === req.user._id.toString(),
  );

  const updated = await Comment.findByIdAndUpdate(
    commentId,
    alreadyLiked
      ? { $pull: { likes: req.user._id } }
      : { $addToSet: { likes: req.user._id } },
    { new: true },
  ).select("likes");

  res.status(200).json({
    liked: !alreadyLiked,
    likeCount: updated.likes.length,
  });
});
