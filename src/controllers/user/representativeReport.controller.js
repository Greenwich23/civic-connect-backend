import mongoose from "mongoose";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";
import RepresentativeReport from "../../models/RepresentativeReport.js";
import User from "../../models/User.js";

const REASONS = [
  "inactive",
  "inappropriate_conduct",
  "false_resolution",
  "identity_concern",
  "other",
];

export const reportRepresentative = asyncHandler(async (req, res) => {
  const { communityId, reason, details, relatedIssue } = req.body;

  if (!communityId || !mongoose.isValidObjectId(communityId)) {
    return errorResponse(res, "A valid communityId is required", 400);
  }

  if (!REASONS.includes(reason)) {
    return errorResponse(
      res,
      `reason must be one of: ${REASONS.join(", ")}`,
      400,
    );
  }

  if (!details || details.trim().length < 20) {
    return errorResponse(
      res,
      "details is required and must be at least 20 characters",
      400,
    );
  }

  if (relatedIssue && !mongoose.isValidObjectId(relatedIssue)) {
    return errorResponse(res, "relatedIssue is not a valid id", 400);
  }

  if (!req.user.community || req.user.community.toString() !== communityId) {
    return errorResponse(
      res,
      "You can only report a representative in your own community",
      403,
    );
  }

  const representative = await User.findOne({
    role: "representative",
    "representativeInfo.community": communityId,
    "representativeInfo.isActive": true,
  });

  if (!representative) {
    return errorResponse(
      res,
      "This community doesn't have an active representative to report",
      404,
    );
  }

  if (representative._id.toString() === req.user._id.toString()) {
    return errorResponse(res, "You can't report yourself", 400);
  }

  const existingPendingReport = await RepresentativeReport.findOne({
    reportedRepresentative: representative._id,
    reportedBy: req.user._id,
    status: "pending",
  });

  if (existingPendingReport) {
    return errorResponse(
      res,
      "You already have a pending report against this representative",
      409,
    );
  }

  const report = await RepresentativeReport.create({
    reportedRepresentative: representative._id,
    reportedBy: req.user._id,
    community: communityId,
    reason,
    details: details.trim(),
    relatedIssue: relatedIssue || undefined,
  });

  res.status(201).json({
    message: "Report submitted. An admin will review it shortly.",
    report,
  });
});

export const getMyReports = asyncHandler(async (req, res) => {
  const reports = await RepresentativeReport.find({
    reportedBy: req.user._id,
  })
    .populate("reportedRepresentative", "name email")
    .populate("community", "name")
    .sort({ createdAt: -1 });

  res.json({ reports });
});
