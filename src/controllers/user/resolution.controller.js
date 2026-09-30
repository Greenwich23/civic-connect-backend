import mongoose from "mongoose";
import Resolution from "../../models/Resolution.js";
import Issue from "../../models/Issues.js";
import User from "../../models/User.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";
import { notifyUser } from "../../utils/notify.js";

const VERDICTS = Resolution.schema.path("verdict").enumValues;

/**
 * =========================================================
 * SUBMIT RESOLUTION FEEDBACK
 * POST /api/issues/:issueId/resolution
 *
 * Only makes sense once a representative has actually marked the issue
 * resolved — a citizen is confirming or disputing that specific claim, not
 * reporting on the issue's state in general. One submission per citizen per
 * issue, enforced by the { issue, submittedBy } unique index on Resolution.
 * =========================================================
 */
export const submitFeedback = asyncHandler(async (req, res) => {
  const { issueId } = req.params;
  const { rating, verdict, comment } = req.body;

  if (!mongoose.isValidObjectId(issueId)) {
    return errorResponse(res, "Invalid issue id", 400);
  }

  const ratingNum = Number(rating);

  if (!rating || Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return errorResponse(res, "rating must be a number between 1 and 5", 400);
  }

  if (!VERDICTS.includes(verdict)) {
    return errorResponse(
      res,
      `verdict must be one of: ${VERDICTS.join(", ")}`,
      400,
    );
  }

  const issue = await Issue.findById(issueId);

  if (!issue) {
    return errorResponse(res, "Issue not found", 404);
  }

  if (issue.status !== "resolved") {
    return errorResponse(
      res,
      "You can only submit resolution feedback once this issue has been marked resolved",
      400,
    );
  }

  // multer/Cloudinary — populated by uploadResolutionPhoto.single("photo")
  const photoUrl = req.file?.path;

  let resolution;

  try {
    resolution = await Resolution.create({
      issue: issue._id,
      submittedBy: req.user._id,
      rating: ratingNum,
      verdict,
      comment: comment?.trim() || undefined,
      photoUrl,
    });
  } catch (error) {
    // Duplicate key on the { issue, submittedBy } unique index — race
    // condition or a resubmit attempt slipping past the client
    if (error.code === 11000) {
      return errorResponse(
        res,
        "You've already submitted feedback for this issue",
        400,
      );
    }

    throw error;
  }

  // A dispute is the one outcome that needs to actively reach someone —
  // "fixed"/"partially_fixed" just accumulate as evidence for the stats below
  if (verdict === "still_exists") {
    const representative = await User.findOne({
      role: "representative",
      "representativeInfo.community": issue.community,
      "representativeInfo.isActive": true,
    });

    if (representative) {
      await notifyUser({
        recipient: representative._id,
        type: "resolution_disputed",
        message: `${req.user.name} says "${issue.title}" isn't actually resolved`,
        relatedIssue: issue._id,
      });
    }
  }

  res.status(201).json({
    message: "Feedback submitted",
    resolution,
  });
});

/**
 * =========================================================
 * GET RESOLUTION STATS
 * GET /api/issues/:issueId/resolution
 *
 * Public — anyone viewing the issue should be able to see whether the
 * community actually agrees it's fixed, not just admins/the reporter.
 * =========================================================
 */
export const getResolutionStats = asyncHandler(async (req, res) => {
  const { issueId } = req.params;

  if (!mongoose.isValidObjectId(issueId)) {
    return errorResponse(res, "Invalid issue id", 400);
  }

  const resolutions = await Resolution.find({ issue: issueId });

  const totalResponses = resolutions.length;

  const verdictBreakdown = {
    fixed: 0,
    partially_fixed: 0,
    still_exists: 0,
  };

  let ratingSum = 0;

  for (const resolution of resolutions) {
    verdictBreakdown[resolution.verdict] += 1;
    ratingSum += resolution.rating;
  }

  const averageRating =
    totalResponses > 0
      ? Math.round((ratingSum / totalResponses) * 10) / 10
      : null;

  // Order matters: "confirmed" only when "fixed" is a true majority (>50%),
  // checked before "disputed" so a resolution that's mostly confirmed but
  // has some disputes still reads as "confirmed", not "mixed".
  let disputeStatus = null;

  if (totalResponses > 0) {
    if (verdictBreakdown.fixed / totalResponses > 0.5) {
      disputeStatus = "confirmed";
    } else if (verdictBreakdown.still_exists / totalResponses >= 0.3) {
      disputeStatus = "disputed";
    } else {
      disputeStatus = "mixed";
    }
  }

  res.json({
    averageRating,
    verdictBreakdown,
    totalResponses,
    disputeStatus,
  });
});

/**
 * =========================================================
 * GET MY FEEDBACK
 * GET /api/issues/:issueId/resolution/mine
 * =========================================================
 */
export const getMyFeedback = asyncHandler(async (req, res) => {
  const { issueId } = req.params;

  if (!mongoose.isValidObjectId(issueId)) {
    return errorResponse(res, "Invalid issue id", 400);
  }

  const resolution = await Resolution.findOne({
    issue: issueId,
    submittedBy: req.user._id,
  });

  res.json({ resolution: resolution || null });
});
