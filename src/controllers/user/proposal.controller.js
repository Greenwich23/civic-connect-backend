import Proposal from "../../models/Proposal.js";
import Issue from "../../models/Issues.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";
import {
  notifyIssueFollowers,
  notifyUser,
  notifyManyUsers,
} from "../../utils/notify.js";

// @desc   Create a proposal for an issue — only allowed if the issue
//         belongs to the logged-in user's own home community
// @route  POST /api/issues/:issueId/proposals
export const createProposal = asyncHandler(async (req, res) => {
  const { issueId } = req.params;
  const { title, description } = req.body;

  if (!title || !description) {
    return errorResponse(res, "Title and description are required", 400);
  }

  const issue = await Issue.findById(issueId);
  if (!issue) {
    return errorResponse(res, "Issue not found", 404);
  }

  if (!req.user.community) {
    return errorResponse(
      res,
      "You need to join a community before proposing a solution",
      400,
    );
  }

  if (issue.community.toString() !== req.user.community.toString()) {
    return errorResponse(
      res,
      "You can only propose solutions for issues in your own community",
      403,
    );
  }

  const proposal = await Proposal.create({
    issue: issue._id,
    title: title.trim(),
    description: description.trim(),
    proposedBy: req.user._id,
  });

  // Move the issue along the pipeline if this is its first proposal
  if (issue.status === "reported" || issue.status === "under_review") {
    issue.status = "action_planned";
    issue.statusHistory.push({
      status: "action_planned",
      updatedBy: req.user._id,
      message: "A community proposal has been submitted for this issue.",
    });
    await issue.save();
  }

  if (issue.reportedBy.toString() !== req.user._id.toString()) {
    await notifyUser({
      recipient: issue.reportedBy,
      type: "proposal_voting_started",
      message: `A new proposal was submitted for your issue "${issue.title}"`,
      relatedIssue: issue._id,
    });
  }

  await notifyIssueFollowers({
    issue,
    type: "proposal_voting_started",
    message: `New proposal submitted on "${issue.title}"`,
    excludeUserId: req.user._id,
  });

  res.status(201).json({ proposal });
});

// @desc   Get all proposals for an issue
// @route  GET /api/issues/:issueId/proposals
export const getProposals = asyncHandler(async (req, res) => {
  const { issueId } = req.params;

  const proposals = await Proposal.find({ issue: issueId })
    .populate("proposedBy", "name")
    .sort("-supportCount -createdAt");

  res.json({ proposals });
});

// @desc   Get a single proposal by ID
// @route  GET /api/proposals/:id
export const getProposalById = asyncHandler(async (req, res) => {
  const proposal = await Proposal.findById(req.params.id)
    .populate("proposedBy", "name")
    .populate("issue", "title community");

  if (!proposal) {
    return errorResponse(res, "Proposal not found", 404);
  }

  res.json({ proposal });
});

// @desc   Get all proposals for the user's community
// @route  GET /api/proposals/community

export const getCommunityProposals = asyncHandler(async (req, res) => {
  if (!req.user.community) {
    return errorResponse(
      res,
      "You need to join a community to view proposals",
      400,
    );
  }

  const issues = await Issue.find({
    community: req.user.community,
  }).select("_id");

  const issueIds = issues.map((issue) => issue._id);

  const proposals = await Proposal.find({
    issue: { $in: issueIds },
  })
    .populate("proposedBy", "name avatarUrl role")
    .populate("issue", "title community")
    .sort("-supportCount -createdAt");

  res.json({ proposals });
});
