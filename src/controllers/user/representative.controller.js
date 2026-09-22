import Issue from "../../models/Issues.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";
import { notifyUser, notifyIssueFollowers } from "../../utils/notify.js";

// @desc   Update an issue's status — representative only, scoped to their own community
// @route  PATCH /api/issues/:id/status
export const updateIssueStatus = asyncHandler(async (req, res) => {
  const { status, message } = req.body;

  const validStatuses = [
    "reported",
    "under_review",
    "action_planned",
    "in_progress",
    "resolved",
  ];
  if (!validStatuses.includes(status)) {
    return errorResponse(res, "Invalid status value", 400);
  }

  const issue = await Issue.findById(req.params.id);
  if (!issue) {
    return errorResponse(res, "Issue not found", 404);
  }

  const repCommunityId = req.user.representativeInfo?.community?.toString();
  if (
    req.user.role !== "representative" ||
    issue.community.toString() !== repCommunityId
  ) {
    return errorResponse(
      res,
      "You can only update issues in your own community",
      403,
    );
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

  res.json({ issue });
});
