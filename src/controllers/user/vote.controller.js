import Vote from "../../models/Votes.js";
import Issue from "../../models/Issues.js";
import Proposal from "../../models/Proposal.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";
import { notifyUser } from "../../utils/notify.js";

const TARGET_MODELS = {
  Issue,
  Proposal,
};

// Issues only ever get "support" (no oppose option on issues per the design doc)
// Proposals allow both "support" and "oppose"
const ALLOWED_VALUES = {
  Issue: ["support"],
  Proposal: ["support", "oppose"],
};

// @desc   Cast (or change) a vote on an Issue or Proposal
// @route  POST /api/votes
// @body   { targetType: "Issue" | "Proposal", targetId, value: "support" | "oppose" }
export const castVote = asyncHandler(async (req, res) => {
  const { targetType, targetId, value } = req.body;

  if (!targetType || !targetId || !value) {
    return errorResponse(
      res,
      "targetType, targetId, and value are required",
      400,
    );
  }

  const Model = TARGET_MODELS[targetType];
  if (!Model) {
    return errorResponse(res, "Invalid targetType", 400);
  }

  if (!ALLOWED_VALUES[targetType].includes(value)) {
    return errorResponse(
      res,
      `Invalid vote value for ${targetType}. Allowed: ${ALLOWED_VALUES[targetType].join(", ")}`,
      400,
    );
  }

  const target = await Model.findById(targetId);
  if (!target) {
    return errorResponse(res, `${targetType} not found`, 404);
  }

  const existingVote = await Vote.findOne({
    user: req.user._id,
    targetType,
    targetId,
  });

  if (existingVote) {
    if (existingVote.value === value) {
      // Same vote pressed again — no-op, avoid double counting
      return res.json({ message: "Vote already recorded", value });
    }

    // Switching from support -> oppose or vice versa (proposals only)
    const oldField =
      existingVote.value === "support" ? "supportCount" : "opposeCount";
    const newField = value === "support" ? "supportCount" : "opposeCount";

    existingVote.value = value;
    await existingVote.save();

    await Model.findByIdAndUpdate(targetId, {
      $inc: { [oldField]: -1, [newField]: 1 },
    });

    return res.json({ message: "Vote updated", value });
  }

  // New vote
  await Vote.create({
    user: req.user._id,
    targetType,
    targetId,
    value,
  });

  const countField = value === "support" ? "supportCount" : "opposeCount";
  await Model.findByIdAndUpdate(targetId, { $inc: { [countField]: 1 } });

  if (!existingVote && targetType === "Issue" && value === "support") {
    const issue = await Issue.findById(targetId);
    if (issue && issue.reportedBy.toString() !== req.user._id.toString()) {
      await notifyUser({
        recipient: issue.reportedBy,
        type: "new_support",
        message: `Your issue "${issue.title}" received new support`,
        relatedIssue: issue._id,
      });
    }
  }

  res.status(201).json({ message: "Vote recorded", value });
});

// @desc   Remove the logged-in user's vote from an Issue or Proposal
// @route  DELETE /api/votes/:targetType/:targetId
export const removeVote = asyncHandler(async (req, res) => {
  const { targetType, targetId } = req.params;

  const Model = TARGET_MODELS[targetType];
  if (!Model) {
    return errorResponse(res, "Invalid targetType", 400);
  }

  const vote = await Vote.findOneAndDelete({
    user: req.user._id,
    targetType,
    targetId,
  });

  if (!vote) {
    return errorResponse(res, "No vote found to remove", 404);
  }

  const countField = vote.value === "support" ? "supportCount" : "opposeCount";
  await Model.findByIdAndUpdate(targetId, { $inc: { [countField]: -1 } });

  res.json({ message: "Vote removed" });
});

// @desc   Check whether the logged-in user has voted on a target, and with what value
// @route  GET /api/votes/:targetType/:targetId/status
export const getVoteStatus = asyncHandler(async (req, res) => {
  const { targetType, targetId } = req.params;

  const vote = await Vote.findOne({
    user: req.user._id,
    targetType,
    targetId,
  });

  res.json({
    hasVoted: !!vote,
    value: vote?.value || null,
  });
});
