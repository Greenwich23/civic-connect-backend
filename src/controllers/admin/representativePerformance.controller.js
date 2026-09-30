import mongoose from "mongoose";
import User from "../../models/User.js";
import Issue from "../../models/Issues.js";
import Resolution from "../../models/Resolution.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";

// Matches the per-issue disputeStatus threshold in resolution.controller.js
// — a representative is flagged once at least 30% of the resolution
// feedback across their community's resolved issues disputes the fix.
const DISPUTE_THRESHOLD = 0.3;

// Note: this attributes feedback to whoever *currently* represents a
// community, not whoever actually marked each individual issue resolved —
// simpler, and correct in the common case, but if a rep was recently
// replaced, feedback on their predecessor's resolutions counts toward them
// until it ages out of the "resolved issues in this community" list.
const summarizeResolutions = (resolutions) => {
  const totalResponses = resolutions.length;
  const disputedCount = resolutions.filter(
    (r) => r.verdict === "still_exists",
  ).length;
  const ratingSum = resolutions.reduce((sum, r) => sum + r.rating, 0);

  return {
    totalResponses,
    disputedCount,
    averageRating:
      totalResponses > 0
        ? Math.round((ratingSum / totalResponses) * 10) / 10
        : null,
    disputedPercent:
      totalResponses > 0
        ? Math.round((disputedCount / totalResponses) * 100)
        : 0,
  };
};

// @desc   Resolution-feedback performance for every active representative —
//         lets admins spot reps marking issues "resolved" without it
//         actually holding up, instead of having to check issue by issue
// @route  GET /api/admin/representative-performance
export const getRepresentativePerformance = asyncHandler(async (req, res) => {
  const representatives = await User.find({
    role: "representative",
    "representativeInfo.isActive": true,
  })
    .select("name email representativeInfo")
    .populate("representativeInfo.community", "name");

  const performance = await Promise.all(
    representatives.map(async (rep) => {
      const community = rep.representativeInfo?.community;

      const base = {
        representative: { _id: rep._id, name: rep.name, email: rep.email },
        community: community ? { _id: community._id, name: community.name } : null,
        appointedAt: rep.representativeInfo?.appointedAt || null,
        resolvedIssueCount: 0,
        totalResponses: 0,
        averageRating: null,
        disputedCount: 0,
        disputedPercent: 0,
        flagged: false,
      };

      if (!community) return base;

      const resolvedIssues = await Issue.find({
        community: community._id,
        status: "resolved",
      }).select("_id");

      if (resolvedIssues.length === 0) {
        return { ...base, resolvedIssueCount: 0 };
      }

      const resolutions = await Resolution.find({
        issue: { $in: resolvedIssues.map((i) => i._id) },
      });

      const summary = summarizeResolutions(resolutions);

      return {
        ...base,
        resolvedIssueCount: resolvedIssues.length,
        ...summary,
        flagged:
          summary.totalResponses > 0 &&
          summary.disputedCount / summary.totalResponses >= DISPUTE_THRESHOLD,
      };
    }),
  );

  // Worst first — the whole point is to surface problems without having to hunt for them
  performance.sort((a, b) => b.disputedPercent - a.disputedPercent);

  res.json({ performance });
});

// @desc   One representative's resolved issues, each with its own resolution-feedback summary
// @route  GET /api/admin/representative-performance/:userId/issues
export const getRepresentativeResolvedIssues = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.isValidObjectId(userId)) {
    return errorResponse(res, "Invalid representative id", 400);
  }

  const rep = await User.findOne({ _id: userId, role: "representative" })
    .select("name email representativeInfo")
    .populate("representativeInfo.community", "name");

  if (!rep) {
    return errorResponse(res, "Representative not found", 404);
  }

  const community = rep.representativeInfo?.community;

  if (!community) {
    return res.json({
      representative: { _id: rep._id, name: rep.name, email: rep.email },
      community: null,
      issues: [],
    });
  }

  const issues = await Issue.find({
    community: community._id,
    status: "resolved",
  })
    .select("title resolvedAt createdAt")
    .sort("-resolvedAt");

  const issuesWithStats = await Promise.all(
    issues.map(async (issue) => {
      const resolutions = await Resolution.find({ issue: issue._id });
      const summary = summarizeResolutions(resolutions);

      return {
        _id: issue._id,
        title: issue.title,
        resolvedAt: issue.resolvedAt,
        ...summary,
      };
    }),
  );

  res.json({
    representative: { _id: rep._id, name: rep.name, email: rep.email },
    community: { _id: community._id, name: community.name },
    issues: issuesWithStats,
  });
});
