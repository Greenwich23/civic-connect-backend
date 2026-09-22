import Community from "../../models/Community.js";
import User from "../../models/User.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";

// @desc   Get all communities (optionally filter by level, status)
// @route  GET /api/communities
export const getAllCommunities = asyncHandler(async (req, res) => {
  const { level, status } = req.query;

  const filter = {};
  if (level) filter.level = level;
  if (status) filter.status = status;

  const communities = await Community.find(filter)
    .populate("parent", "name level")
    .sort("name");

  res.json({ communities });
});

// @desc   Get a single community by ID
// @route  GET /api/communities/:id
export const getCommunityById = asyncHandler(async (req, res) => {
  const community = await Community.findById(req.params.id).populate(
    "parent",
    "name level",
  );

  if (!community) {
    return errorResponse(res, "Community not found", 404);
  }

  res.json({ community });
});

// @desc   Check if a proposed community name already exists (used before founding)
// @route  GET /api/communities/check?name=Jabi
export const checkCommunityNameExists = asyncHandler(async (req, res) => {
  const { name } = req.query;

  if (!name) {
    return errorResponse(res, "A name query parameter is required", 400);
  }

  const existing = await Community.findOne({
    name: { $regex: `^${name.trim()}$`, $options: "i" }, // case-insensitive exact match
    level: "community",
  });

  res.json({
    exists: !!existing,
    community: existing || null,
  });
});

// @desc   Get only active (represented) communities
// @route  GET /api/communities/active
export const getActiveCommunities = asyncHandler(async (req, res) => {
  const communities = await Community.find({
    level: "community",
    status: "active",
  })
    .populate("parent", "name")
    .sort("name");

  res.json({ communities });
});

// @desc   Get communities citizens can join — regardless of representative status,
//         since being unrepresented doesn't block participation, just status updates
// @route  GET /api/communities/joinable
// controllers/user/community.controller.js

export const getJoinableCommunities = asyncHandler(async (req, res) => {
  const communities = await Community.aggregate([
    { $match: { level: "community" } },
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
      },
    },
    { $project: { members: 0, issues: 0 } },
    { $sort: { name: 1 } },
  ]);

  await Community.populate(communities, { path: "parent", select: "name" });

  res.json({ communities });
});

// @desc   Join a community — sets/overwrites the user's single home community
// @route  PATCH /api/communities/join
export const joinCommunity = asyncHandler(async (req, res) => {
  const { communityId } = req.body;

  if (!communityId) {
    return errorResponse(res, "communityId is required", 400);
  }

  const community = await Community.findOne({
    _id: communityId,
    level: "community",
  });

  if (!community) {
    return errorResponse(res, "Community not found", 404);
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { community: community._id },
    { new: true },
  ).select("-password");

  res.json({
    message: `You've joined ${community.name}`,
    user,
  });
});

// @desc   Leave the current community — clears the user's home community
// @route  PATCH /api/communities/leave
export const leaveCommunity = asyncHandler(async (req, res) => {
  if (!req.user.community) {
    return errorResponse(res, "You are not currently in a community", 400);
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { community: null },
    { new: true },
  ).select("-password");

  res.json({
    message: "You've left your community",
    user,
  });
});
