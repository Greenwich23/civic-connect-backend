import mongoose from "mongoose";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";
import RepresentativeReport from "../../models/RepresentativeReport.js";
import Community from "../../models/Community.js";
import { notifyUser } from "../../utils/notify.js";
import { revokeRepresentativeStatus } from "../../utils/representativeActions.js";

// @desc   List representative reports, optionally filtered by status
// @route  GET /api/admin/representative-reports?status=pending
export const getReports = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};

  if (status) {
    filter.status = status;
  }

  const reports = await RepresentativeReport.find(filter)
    .populate("reportedRepresentative", "name email")
    .populate("reportedBy", "name")
    .populate("community", "name")
    .populate("relatedIssue", "title")
    .sort("-createdAt");

  res.json({ reports });
});

// @desc   Get a single report, plus how many total reports exist against
//         the same representative (so the admin can spot a pattern)
// @route  GET /api/admin/representative-reports/:id
export const getReportById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return errorResponse(res, "Invalid report id", 400);
  }

  const report = await RepresentativeReport.findById(req.params.id)
    .populate("reportedRepresentative", "name email")
    .populate("reportedBy", "name")
    .populate("community", "name")
    .populate("relatedIssue", "title")
    .populate("reviewedBy", "name");

  if (!report) {
    return errorResponse(res, "Report not found", 404);
  }

  const totalReportsAgainstRepresentative =
    await RepresentativeReport.countDocuments({
      reportedRepresentative: report.reportedRepresentative,
    });

  res.json({ report, totalReportsAgainstRepresentative });
});

// @desc   Review a report: mark it reviewed/dismissed, optionally remove the representative
// @route  PATCH /api/admin/representative-reports/:id/review
// @body   { decision: "reviewed" | "dismissed", reviewNote, removeRepresentative? }
export const reviewReport = asyncHandler(async (req, res) => {
  const { decision, reviewNote, removeRepresentative } = req.body;

  if (!mongoose.isValidObjectId(req.params.id)) {
    return errorResponse(res, "Invalid report id", 400);
  }

  if (!["reviewed", "dismissed"].includes(decision)) {
    return errorResponse(res, 'decision must be "reviewed" or "dismissed"', 400);
  }

  const report = await RepresentativeReport.findById(req.params.id);

  if (!report) {
    return errorResponse(res, "Report not found", 404);
  }

  if (report.status !== "pending") {
    return errorResponse(
      res,
      `This report has already been ${report.status}`,
      400,
    );
  }

  let removedRepresentativeId = null;

  if (removeRepresentative) {
    const { user, error, status } = await revokeRepresentativeStatus(
      report.reportedRepresentative,
    );

    if (error) {
      return errorResponse(res, error, status);
    }

    await Community.findByIdAndUpdate(report.community, {
      status: "unrepresented",
    });

    removedRepresentativeId = user._id;
  }

  report.status = decision;
  report.reviewedBy = req.user._id;
  report.reviewNote = reviewNote;
  report.reviewedAt = new Date();
  await report.save();

  // The review is already saved, so a notification failure shouldn't turn
  // into an error response for the admin.
  try {
    await notifyUser({
      recipient: report.reportedBy,
      type: "representative_report_reviewed",
      message: "Your report about a representative has been reviewed by an admin.",
    });

    if (removedRepresentativeId) {
      await notifyUser({
        recipient: removedRepresentativeId,
        type: "representative_removed",
        message:
          "You have been removed as a representative following an admin review.",
      });
    }
  } catch (err) {
    console.error(`[notify] representative report ${report._id}: ${err.message}`);
  }

  res.json({
    message: `Report ${decision}`,
    report,
  });
});
