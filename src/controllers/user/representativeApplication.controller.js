import RepresentativeApplication from "../../models/RepresentativeApplication.js";
import Community from "../../models/Community.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";
import { encrypt, maskNIN } from "../../utils/encryption.js";

// @desc   Apply to become a representative — either found a brand new community,
//         or take over an existing one that currently has no representative
// @route  POST /api/representative-applications
// @body   { applicationType, communityName?, cityId? (found_new_community),
//           communityId? (represent_existing), yearsInCommunity, phoneNumber,
//           nin, statement }
export const applyForRepresentative = asyncHandler(async (req, res) => {
  const {
    applicationType = "found_new_community",
    communityName,
    cityId,
    communityId,
    yearsInCommunity,
    phoneNumber,
    nin,
    statement,
    officialTitle,
  } = req.body;

  // Multipart form fields arrive as strings, including booleans
  const claimsOfficialStatus =
    req.body.claimsOfficialStatus === "true" ||
    req.body.claimsOfficialStatus === true;

  if (!["found_new_community", "represent_existing"].includes(applicationType)) {
    return errorResponse(res, "Invalid application type", 400);
  }

  if (!phoneNumber || !nin || !statement) {
    return errorResponse(res, "Missing required fields", 400);
  }

  if (nin.length !== 11) {
    return errorResponse(res, "NIN must be exactly 11 digits", 400);
  }

  if (claimsOfficialStatus && !officialTitle?.trim()) {
    return errorResponse(
      res,
      "officialTitle is required when claiming a local government/council position",
      400,
    );
  }

  // Prevent duplicate pending applications from the same user
  const existingPending = await RepresentativeApplication.findOne({
    applicant: req.user._id,
    status: "pending",
  });

  if (existingPending) {
    return errorResponse(
      res,
      "You already have a pending application. Please wait for it to be reviewed.",
      400,
    );
  }

  // Uploaded files — multer/Cloudinary populate req.files
  const passportPhotoUrl = req.files?.passportPhoto?.[0]?.path;
  const proofOfResidenceUrl = req.files?.proofOfResidence?.[0]?.path;

  if (!passportPhotoUrl) {
    return errorResponse(res, "Passport photo is required", 400);
  }

  if (!proofOfResidenceUrl) {
    return errorResponse(res, "Proof of residence is required", 400);
  }

  const officialDocumentUrl = req.files?.officialDocument?.[0]?.path;

  if (claimsOfficialStatus && !officialDocumentUrl) {
    return errorResponse(
      res,
      "Proof of your official position (appointment letter, staff ID, etc.) is required",
      400,
    );
  }

  let application;
  let responseCommunityName;

  if (applicationType === "represent_existing") {
    if (!communityId) {
      return errorResponse(
        res,
        "communityId is required to apply to represent an existing community",
        400,
      );
    }

    // You can only apply to represent the community you're already a
    // member of — this isn't just a UI restriction, it's enforced here too.
    if (!req.user.community || req.user.community.toString() !== communityId) {
      return errorResponse(
        res,
        "You can only apply to represent the community you're currently a member of",
        403,
      );
    }

    const community = await Community.findOne({
      _id: communityId,
      level: "community",
    });

    if (!community) {
      return errorResponse(res, "Community not found", 404);
    }

    if (community.status !== "unrepresented") {
      return errorResponse(
        res,
        `${community.name} already has a representative`,
        409,
      );
    }

    application = await RepresentativeApplication.create({
      applicant: req.user._id,
      applicationType: "represent_existing",
      community: community._id,
      statement: statement.trim(),
      phoneNumber,
      nin: encrypt(nin),
      passportPhotoUrl,
      proofOfResidenceUrl,
      yearsInCommunity,
      claimsOfficialStatus,
      officialTitle: claimsOfficialStatus ? officialTitle.trim() : undefined,
      officialDocumentUrl: claimsOfficialStatus ? officialDocumentUrl : undefined,
    });

    responseCommunityName = community.name;
  } else {
    if (!communityName) {
      return errorResponse(res, "communityName is required", 400);
    }

    if (!cityId) {
      return errorResponse(
        res,
        "cityId is required — choose which city this community belongs to",
        400,
      );
    }

    const city = await Community.findOne({ _id: cityId, level: "city" });

    if (!city) {
      return errorResponse(res, "City not found", 404);
    }

    // Check the proposed community name doesn't already exist under this
    // same city — the same neighborhood name can exist in different cities
    const trimmedName = communityName.trim();
    const existingCommunity = await Community.findOne({
      name: { $regex: `^${trimmedName}$`, $options: "i" },
      level: "community",
      parent: city._id,
    });

    if (existingCommunity) {
      return errorResponse(
        res,
        `"${trimmedName}" already exists under ${city.name} on CivicPulse. You can apply to represent it instead.`,
        409,
      );
    }

    application = await RepresentativeApplication.create({
      applicant: req.user._id,
      applicationType: "found_new_community",
      proposedCommunityName: trimmedName,
      proposedParent: city._id,
      statement: statement.trim(),
      phoneNumber,
      nin: encrypt(nin),
      passportPhotoUrl,
      proofOfResidenceUrl,
      yearsInCommunity,
      claimsOfficialStatus,
      officialTitle: claimsOfficialStatus ? officialTitle.trim() : undefined,
      officialDocumentUrl: claimsOfficialStatus ? officialDocumentUrl : undefined,
    });

    responseCommunityName = trimmedName;
  }

  res.status(201).json({
    message:
      applicationType === "represent_existing"
        ? "Your request to represent this community has been submitted for review"
        : "Your community creation request has been submitted for review",
    application: {
      _id: application._id,
      applicationType: application.applicationType,
      proposedCommunityName:
        application.proposedCommunityName || responseCommunityName,
      community: application.community,
      status: application.status,
      createdAt: application.createdAt,
      nin: maskNIN(nin), // never return the raw or encrypted NIN to the client
    },
  });
});

// @desc   Get the logged-in user's own application status
// @route  GET /api/representative-applications/mine
export const getMyApplication = asyncHandler(async (req, res) => {
  const application = await RepresentativeApplication.findOne({
    applicant: req.user._id,
  })
    .sort("-createdAt")
    .populate("community", "name")
    .populate("proposedParent", "name");

  if (!application) {
    return res.json({ application: null });
  }

  res.json({
    application: {
      ...application.toObject(),
      nin: undefined, // strip encrypted NIN from any client-facing response
    },
  });
});

// @desc   Withdraw a pending application
// @route  DELETE /api/representative-applications/mine
export const withdrawApplication = asyncHandler(async (req, res) => {
  const application = await RepresentativeApplication.findOne({
    applicant: req.user._id,
    status: "pending",
  });

  if (!application) {
    return errorResponse(res, "No pending application found", 404);
  }

  await application.deleteOne();

  res.json({ message: "Application withdrawn" });
});
