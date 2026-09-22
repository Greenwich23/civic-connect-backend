import mongoose from "mongoose";
import Community from "../../models/Community.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";

const LEVELS = Community.schema.path("level").enumValues;
const STATUSES = Community.schema.path("status").enumValues;

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Case-insensitive name match within the same level, optionally ignoring one doc
const nameTaken = (name, level, excludeId) =>
  Community.exists({
    name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
    level,
    ...(excludeId && { _id: { $ne: excludeId } }),
  });

// @desc   Admin manually adds a community (housekeeping, not the citizen founding flow)
// @route  POST /api/admin/communities
// @body   { name, level, parent }
export const createCommunity = asyncHandler(async (req, res) => {
  const { level, parent } = req.body;
  const name = req.body.name?.trim();

  if (!name || !level) {
    return errorResponse(res, "name and level are required", 400);
  }

  if (!LEVELS.includes(level)) {
    return errorResponse(res, `level must be one of: ${LEVELS.join(", ")}`, 400);
  }

  let parentId = null;

  if (level === "community") {
    // Communities sit under a city, matching how the founding flow anchors them
    if (!parent || !mongoose.isValidObjectId(parent)) {
      return errorResponse(res, "A valid parent city is required", 400);
    }

    const parentCommunity = await Community.findById(parent);

    if (!parentCommunity || parentCommunity.level !== "city") {
      return errorResponse(res, "Parent must be an existing city", 400);
    }

    parentId = parentCommunity._id;
  } else if (parent) {
    return errorResponse(res, "A city cannot have a parent", 400);
  }

  if (await nameTaken(name, level)) {
    return errorResponse(res, `A ${level} named "${name}" already exists`, 409);
  }

  const community = await Community.create({
    name,
    level,
    parent: parentId,
  });

  res.status(201).json({ message: "Community created", community });
});

// @desc   Edit a community's name, parent or status
// @route  PATCH /api/admin/communities/:id
// @body   { name?, parent?, status? }
export const updateCommunity = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return errorResponse(res, "Invalid community id", 400);
  }

  const { name, parent, status } = req.body;

  if (name === undefined && parent === undefined && status === undefined) {
    return errorResponse(
      res,
      "Provide at least one of: name, parent, status",
      400,
    );
  }

  const community = await Community.findById(req.params.id);

  if (!community) {
    return errorResponse(res, "Community not found", 404);
  }

  if (name !== undefined) {
    const trimmed = String(name).trim();

    if (!trimmed) {
      return errorResponse(res, "name cannot be empty", 400);
    }

    if (await nameTaken(trimmed, community.level, community._id)) {
      return errorResponse(
        res,
        `A ${community.level} named "${trimmed}" already exists`,
        409,
      );
    }

    community.name = trimmed;
  }

  if (parent !== undefined) {
    if (community.level === "city") {
      return errorResponse(res, "A city cannot have a parent", 400);
    }

    if (!mongoose.isValidObjectId(parent)) {
      return errorResponse(res, "Invalid parent id", 400);
    }

    const parentCommunity = await Community.findById(parent);

    if (!parentCommunity || parentCommunity.level !== "city") {
      return errorResponse(res, "Parent must be an existing city", 400);
    }

    community.parent = parentCommunity._id;
  }

  if (status !== undefined) {
    if (!STATUSES.includes(status)) {
      return errorResponse(
        res,
        `status must be one of: ${STATUSES.join(", ")}`,
        400,
      );
    }

    community.status = status;
  }

  await community.save();
  await community.populate("parent", "name level");

  res.json({ message: "Community updated", community });
});
