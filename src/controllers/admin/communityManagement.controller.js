import mongoose from "mongoose";
import Community from "../../models/Community.js";
import User from "../../models/User.js";
import Issue from "../../models/Issues.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";

const LEVELS = Community.schema.path("level").enumValues;
const STATUSES = Community.schema.path("status").enumValues;

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Case-insensitive name match within the same level, optionally ignoring one doc.
// For a "community", uniqueness is scoped to its parent city — "Central" in
// Lagos and "Central" in Kano are different places, so both may exist. A
// "city" has no parent, so its name is checked globally instead.
const nameTaken = (name, level, excludeId, parentId) =>
  Community.exists({
    name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
    level,
    ...(level === "community" && { parent: parentId }),
    ...(excludeId && { _id: { $ne: excludeId } }),
  });

const clampPage = (value) => Math.max(parseInt(value) || 1, 1);
const clampLimit = (value) => Math.min(Math.max(parseInt(value) || 20, 1), 100);

// @desc   List all communities with member/issue counts (admin housekeeping view)
// @route  GET /api/admin/communities?level=&status=
export const getAllCommunities = asyncHandler(async (req, res) => {
  const { level, status } = req.query;

  const match = {};

  if (level) {
    if (!LEVELS.includes(level)) {
      return errorResponse(res, `level must be one of: ${LEVELS.join(", ")}`, 400);
    }
    match.level = level;
  }

  if (status) {
    if (!STATUSES.includes(status)) {
      return errorResponse(res, `status must be one of: ${STATUSES.join(", ")}`, 400);
    }
    match.status = status;
  }

  const communities = await Community.aggregate([
    { $match: match },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "community",
        as: "members",
      },
    },
    {
      $lookup: {
        from: "issues",
        localField: "_id",
        foreignField: "community",
        as: "issues",
      },
    },
    {
      $addFields: {
        memberCount: { $size: "$members" },
        issueCount: { $size: "$issues" },
        resolvedCount: {
          $size: {
            $filter: {
              input: "$issues",
              as: "issue",
              cond: { $eq: ["$$issue.status", "resolved"] },
            },
          },
        },
      },
    },
    { $project: { members: 0, issues: 0 } },
    { $sort: { name: 1 } },
  ]);

  await Community.populate(communities, { path: "parent", select: "name level" });

  res.json({ communities });
});

// @desc   Single community, with its members and issues (paginated separately)
// @route  GET /api/admin/communities/:id?membersPage=&issuesPage=&limit=
export const getCommunityById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return errorResponse(res, "Invalid community id", 400);
  }

  const community = await Community.findById(req.params.id).populate(
    "parent",
    "name level",
  );

  if (!community) {
    return errorResponse(res, "Community not found", 404);
  }

  const limit = clampLimit(req.query.limit);
  const membersPage = clampPage(req.query.membersPage);
  const issuesPage = clampPage(req.query.issuesPage);

  const [members, memberTotal, issues, issueTotal] = await Promise.all([
    User.find({ community: community._id })
      .select("-password")
      .sort("-createdAt")
      .skip((membersPage - 1) * limit)
      .limit(limit),
    User.countDocuments({ community: community._id }),
    Issue.find({ community: community._id })
      .sort("-createdAt")
      .skip((issuesPage - 1) * limit)
      .limit(limit),
    Issue.countDocuments({ community: community._id }),
  ]);

  res.json({
    community,
    members,
    membersPagination: {
      page: membersPage,
      limit,
      total: memberTotal,
      totalPages: Math.ceil(memberTotal / limit),
    },
    issues,
    issuesPagination: {
      page: issuesPage,
      limit,
      total: issueTotal,
      totalPages: Math.ceil(issueTotal / limit),
    },
  });
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

  if (await nameTaken(name, level, null, parentId)) {
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

  // Resolve parent first — a rename's uniqueness check needs to know which
  // city the community sits under (its new one, if that's changing too).
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

  if (name !== undefined) {
    const trimmed = String(name).trim();

    if (!trimmed) {
      return errorResponse(res, "name cannot be empty", 400);
    }

    if (
      await nameTaken(trimmed, community.level, community._id, community.parent)
    ) {
      return errorResponse(
        res,
        `A ${community.level} named "${trimmed}" already exists`,
        409,
      );
    }

    community.name = trimmed;
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
