import RepresentativeApplication from "../../models/RepresentativeApplication.js";
import Community from "../../models/Community.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";
import { encrypt, maskNIN } from "../../utils/encryption.js";

// @desc   Submit a request to found a new community (and become its representative)
// @route  POST /api/representative-applications
export const applyForRepresentative = asyncHandler(async (req, res) => {
  const { communityName, yearsInCommunity, phoneNumber, nin, statement } =
    req.body;

  if (!communityName || !phoneNumber || !nin || !statement) {
    return errorResponse(res, "Missing required fields", 400);
  }

  if (nin.length !== 11) {
    return errorResponse(res, "NIN must be exactly 11 digits", 400);
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

  // Check the proposed community name doesn't already exist
  const trimmedName = communityName.trim();
  const existingCommunity = await Community.findOne({
    name: { $regex: `^${trimmedName}$`, $options: "i" },
    level: "community",
  });

  if (existingCommunity) {
    return errorResponse(
      res,
      `"${trimmedName}" already exists on CivicPulse. You can apply to represent it instead.`,
      409,
    );
  }

  // Find the "Abuja" city-level anchor to use as the parent
  const abuja = await Community.findOne({ level: "city", name: "Abuja" });
  if (!abuja) {
    return errorResponse(
      res,
      "Platform configuration error: city anchor not found",
      500,
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

  const application = await RepresentativeApplication.create({
    applicant: req.user._id,
    applicationType: "found_new_community",
    proposedCommunityName: trimmedName,
    proposedParent: abuja._id,
    statement: statement.trim(),
    phoneNumber,
    nin: encrypt(nin),
    passportPhotoUrl,
    proofOfResidenceUrl,
    yearsInCommunity,
  });

  res.status(201).json({
    message: "Your community creation request has been submitted for review",
    application: {
      _id: application._id,
      applicationType: application.applicationType,
      proposedCommunityName: application.proposedCommunityName,
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
