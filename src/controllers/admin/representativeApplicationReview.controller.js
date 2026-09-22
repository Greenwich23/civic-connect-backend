import mongoose from "mongoose";
import RepresentativeApplication from "../../models/RepresentativeApplication.js";
import Community from "../../models/Community.js";
import User from "../../models/User.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";
import { decrypt } from "../../utils/encryption.js";
import { notifyUser } from "../../utils/notify.js";

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// @desc   List all pending representative / community-creation applications
// @route  GET /api/admin/representative-applications
export const getPendingApplications = asyncHandler(async (req, res) => {
  const applications = await RepresentativeApplication.find({
    status: "pending",
  })
    .select("-nin") // the encrypted NIN never appears in the list view
    .populate("applicant", "name email")
    .populate("proposedParent", "name")
    .populate("community", "name")
    .sort("-createdAt");

  res.json({ applications });
});

// @desc   Get a single application, with the NIN decrypted (admin detail view only)
// @route  GET /api/admin/representative-applications/:id
export const getApplicationById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return errorResponse(res, "Invalid application id", 400);
  }

  const application = await RepresentativeApplication.findById(req.params.id)
    .populate("applicant", "name email")
    .populate("proposedParent", "name")
    .populate("community", "name")
    .populate("reviewedBy", "name");

  if (!application) {
    return errorResponse(res, "Application not found", 404);
  }

  res.json({
    application: {
      ...application.toObject(),
      nin: decrypt(application.nin),
    },
  });
});

// @desc   Approve or reject an application
// @route  PATCH /api/admin/representative-applications/:id/review
// @body   { decision: "approved" | "rejected", reviewNote }
export const reviewApplication = asyncHandler(async (req, res) => {
  const { decision, reviewNote } = req.body;

  if (!mongoose.isValidObjectId(req.params.id)) {
    return errorResponse(res, "Invalid application id", 400);
  }

  if (!["approved", "rejected"].includes(decision)) {
    return errorResponse(res, 'decision must be "approved" or "rejected"', 400);
  }

  const application = await RepresentativeApplication.findById(req.params.id);

  if (!application) {
    return errorResponse(res, "Application not found", 404);
  }

  if (application.status !== "pending") {
    return errorResponse(
      res,
      `This application has already been ${application.status}`,
      400,
    );
  }

  const applicant = await User.findById(application.applicant);

  if (!applicant) {
    return errorResponse(res, "Applicant no longer exists", 404);
  }

  let communityName = application.proposedCommunityName;

  if (decision === "approved") {
    // Never turn an admin account into a representative
    if (applicant.role === "admin") {
      return errorResponse(res, "Applicant is an admin account", 400);
    }

    let community;

    if (application.applicationType === "found_new_community") {
      const duplicate = await Community.findOne({
        name: {
          $regex: `^${escapeRegex(application.proposedCommunityName)}$`,
          $options: "i",
        },
        level: "community",
      });

      if (duplicate) {
        return errorResponse(
          res,
          `A community named "${application.proposedCommunityName}" already exists`,
          409,
        );
      }

      community = await Community.create({
        name: application.proposedCommunityName,
        level: "community",
        parent: application.proposedParent,
        status: "active",
        foundedBy: application.applicant,
      });

      application.community = community._id;
    } else {
      community = await Community.findById(application.community);

      if (!community) {
        return errorResponse(res, "Community to represent not found", 404);
      }

      community.status = "active";
      await community.save();
    }

    communityName = community.name;

    // Step down whoever currently represents this community
    await User.updateMany(
      {
        _id: { $ne: applicant._id },
        role: "representative",
        "representativeInfo.community": community._id,
        "representativeInfo.isActive": true,
      },
      {
        $set: {
          role: "citizen",
          "representativeInfo.isActive": false,
        },
      },
    );

    // Promote the applicant
    applicant.role = "representative";
    applicant.representativeInfo = {
      community: community._id,
      appointedAt: new Date(),
      isActive: true,
    };
    await applicant.save();
  }

  application.status = decision;
  application.reviewedBy = req.user._id;
  application.reviewNote = reviewNote;
  application.reviewedAt = new Date();
  await application.save();

  // The review is already saved at this point, so a notification failure
  // shouldn't turn into an error response for the admin.
  try {
    const note = reviewNote ? ` Note from the reviewer: ${reviewNote}` : "";

    await notifyUser({
      recipient: applicant._id,
      type: decision === "approved" ? "application_approved" : "application_rejected",
      message:
        decision === "approved"
          ? `Your application was approved. You are now the representative of ${communityName}.${note}`
          : `Your application${communityName ? ` for ${communityName}` : ""} was not approved.${note}`,
    });
  } catch (err) {
    console.error(`[notify] application ${application._id}: ${err.message}`);
  }

  res.json({
    message: `Application ${decision}`,
    application: {
      ...application.toObject(),
      nin: undefined, // encrypted NIN is never returned from a review action
    },
  });
});

// @desc   Revoke an existing representative's status
// @route  PATCH /api/admin/representative-applications/representatives/:userId/remove
export const removeRepresentative = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) {
    return errorResponse(res, "Invalid user id", 400);
  }

  const user = await User.findById(req.params.userId);

  if (!user) {
    return errorResponse(res, "User not found", 404);
  }

  if (user.role !== "representative") {
    return errorResponse(res, "This user is not a representative", 400);
  }

  user.role = "citizen";
  user.representativeInfo.isActive = false;
  await user.save();

  res.json({
    message: "Representative status revoked",
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      representativeInfo: user.representativeInfo,
    },
  });
});
