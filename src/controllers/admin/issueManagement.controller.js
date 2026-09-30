import mongoose from "mongoose";
import Issue from "../../models/Issues.js";
import Comment from "../../models/Comments.js";
import Proposal from "../../models/Proposal.js";
import User from "../../models/User.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";
import { notifyUser, notifyIssueFollowers } from "../../utils/notify.js";

const STATUSES = Issue.schema.path("status").enumValues;

const clampPage = (value) => Math.max(parseInt(value) || 1, 1);
const clampLimit = (value) => Math.min(Math.max(parseInt(value) || 20, 1), 100);

// @desc   List every reported issue platform-wide (admin oversight view —
//         includes hidden ones, unlike the citizen-facing /api/issues)
// @route  GET /api/admin/issues?status=&category=&community=&moderationStatus=&search=&page=&limit=
export const getAllIssues = asyncHandler(async (req, res) => {
  const { status, category, community, moderationStatus, search } = req.query;

  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit);

  const filter = {};

  if (status) {
    if (!STATUSES.includes(status)) {
      return errorResponse(res, `status must be one of: ${STATUSES.join(", ")}`, 400);
    }
    filter.status = status;
  }

  if (category) filter.category = category;

  if (community) {
    if (!mongoose.isValidObjectId(community)) {
      return errorResponse(res, "Invalid community id", 400);
    }
    filter.community = community;
  }

  if (moderationStatus) {
    if (!["visible", "hidden"].includes(moderationStatus)) {
      return errorResponse(res, 'moderationStatus must be "visible" or "hidden"', 400);
    }
    filter.moderationStatus = moderationStatus;
  }

  if (search?.trim()) {
    filter.$or = [
      { title: { $regex: search.trim(), $options: "i" } },
      { description: { $regex: search.trim(), $options: "i" } },
    ];
  }

  const [issues, total] = await Promise.all([
    Issue.find(filter)
      .populate("reportedBy", "name email")
      .populate({
        path: "community",
        select: "name parent",
        populate: { path: "parent", select: "name" },
      })
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(limit),
    Issue.countDocuments(filter),
  ]);

  res.json({
    issues,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// @desc   Full detail on one issue, plus who (if anyone) currently represents its community
// @route  GET /api/admin/issues/:id
export const getIssueById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return errorResponse(res, "Invalid issue id", 400);
  }

  const issue = await Issue.findById(req.params.id)
    .populate("reportedBy", "name email")
    .populate({
      path: "community",
      select: "name level parent",
      populate: { path: "parent", select: "name" },
    })
    .populate("statusHistory.updatedBy", "name role");

  if (!issue) {
    return errorResponse(res, "Issue not found", 404);
  }

  const [commentCount, proposalCount, representative] = await Promise.all([
    Comment.countDocuments({ issue: issue._id }),
    Proposal.countDocuments({ issue: issue._id }),
    User.findOne({
      role: "representative",
      "representativeInfo.community": issue.community._id,
      "representativeInfo.isActive": true,
    }).select("name email"),
  ]);

  res.json({
    issue,
    commentCount,
    proposalCount,
    representative: representative || null,
  });
});

// @desc   Admin override of an issue's status — works regardless of which
//         community it's in or whether that community has a representative
// @route  PATCH /api/admin/issues/:id/status
// @body   { status, message? }
export const updateIssueStatus = asyncHandler(async (req, res) => {
  const { status, message } = req.body;

  if (!mongoose.isValidObjectId(req.params.id)) {
    return errorResponse(res, "Invalid issue id", 400);
  }

  if (!STATUSES.includes(status)) {
    return errorResponse(res, `status must be one of: ${STATUSES.join(", ")}`, 400);
  }

  const issue = await Issue.findById(req.params.id);

  if (!issue) {
    return errorResponse(res, "Issue not found", 404);
  }

  issue.status = status;
  issue.statusHistory.push({
    status,
    updatedBy: req.user._id,
    message: message?.trim() || undefined,
  });

  if (status === "resolved") {
    issue.resolvedAt = new Date();
  }

  await issue.save();

  const isResolved = status === "resolved";
  const statusLabel = status.replace(/_/g, " ");

  if (issue.reportedBy.toString() !== req.user._id.toString()) {
    await notifyUser({
      recipient: issue.reportedBy,
      type: isResolved ? "issue_resolved" : "status_updated",
      message: isResolved
        ? `Your issue "${issue.title}" has been marked resolved`
        : `Your issue "${issue.title}" is now ${statusLabel}`,
      relatedIssue: issue._id,
    });
  }

  await notifyIssueFollowers({
    issue,
    type: isResolved ? "issue_resolved" : "status_updated",
    message: isResolved
      ? `"${issue.title}" has been marked resolved`
      : `"${issue.title}" is now ${statusLabel}`,
    excludeUserId: req.user._id,
  });

  res.json({ message: "Issue status updated", issue });
});

// @desc   Hide or restore an issue — e.g. spam or duplicate reports.
//         Hiding removes it from every citizen-facing screen immediately.
// @route  PATCH /api/admin/issues/:id/moderate
// @body   { moderationStatus: "visible" | "hidden" }
export const moderateIssue = asyncHandler(async (req, res) => {
  const { moderationStatus } = req.body;

  if (!mongoose.isValidObjectId(req.params.id)) {
    return errorResponse(res, "Invalid issue id", 400);
  }

  if (!["visible", "hidden"].includes(moderationStatus)) {
    return errorResponse(res, 'moderationStatus must be "visible" or "hidden"', 400);
  }

  const issue = await Issue.findById(req.params.id);

  if (!issue) {
    return errorResponse(res, "Issue not found", 404);
  }

  issue.moderationStatus = moderationStatus;
  await issue.save();

  res.json({
    message: `Issue marked ${moderationStatus}`,
    issue,
  });
});
