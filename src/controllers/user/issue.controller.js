import Issue from "../../models/Issues.js";
import Comment from "../../models/Comments.js";
import Proposal from "../../models/Proposal.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";

// @desc   Create a new issue — locked to the user's own home community
// @route  POST /api/issues
export const createIssue = asyncHandler(async (req, res) => {
  const { title, description, category, locationText } = req.body;

  if (!title || !description || !category) {
    return errorResponse(
      res,
      "Title, description, and category are required",
      400,
    );
  }

  if (!req.user.community) {
    return errorResponse(
      res,
      "You need to join a community before reporting an issue",
      400,
    );
  }

  const images = (req.files || []).map((file) => file.path);

  const issue = await Issue.create({
    title: title.trim(),
    description: description.trim(),
    category,
    community: req.user.community, // server-trusted, never taken from client input
    locationText: locationText?.trim() || undefined,
    reportedBy: req.user._id,
    images,
    statusHistory: [
      {
        status: "reported",
        updatedBy: req.user._id,
      },
    ],
  });

  res.status(201).json({ issue });
});

// @desc   Get all issues with filters, search, and sorting
// @route  GET /api/issues
export const getAllIssues = asyncHandler(async (req, res) => {
  const { search, category, status, community, sort } = req.query;

  const filter = {};

  if (category) filter.category = category;
  if (status) filter.status = status;
  if (community) filter.community = community;

  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  let sortOption = "-createdAt"; // default: recently added

  switch (sort) {
    case "most_supported":
      sortOption = "-supportCount";
      break;
    case "most_discussed":
      sortOption = "-commentCount";
      break;
    case "resolved":
      filter.status = "resolved";
      sortOption = "-resolvedAt";
      break;
    case "trending":
      sortOption = "-supportCount -createdAt";
      break;
    case "recent":
    default:
      sortOption = "-createdAt";
  }

  const issues = await Issue.find(filter)
    .populate("community", "name")
    .populate("reportedBy", "name")
    .sort(sortOption);

  res.json({ issues });
});

// @desc   Get a single issue by ID
// @route  GET /api/issues/:id
export const getIssueById = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id)
    .populate("community", "name")
    .populate("reportedBy", "name");

  console.log(issue);

  if (!issue) {
    return errorResponse(res, "Issue not found", 404);
  }

  const [commentCount, proposalCount] = await Promise.all([
    Comment.countDocuments({ issue: issue._id }),
    Proposal.countDocuments({ issue: issue._id }),
  ]);

  res.json({
    issue: {
      ...issue.toObject(),
      commentCount,
      proposalCount,
    },
  });
});

// @desc   Get issues reported by the logged-in user
// @route  GET /api/issues/mine
export const getMyIssues = asyncHandler(async (req, res) => {
  const issues = await Issue.find({ reportedBy: req.user._id })
    .populate("community", "name")
    .sort("-createdAt");

  res.json({ issues });
});

// @desc   Get trending issues — highest recent support/activity
// @route  GET /api/issues/trending
export const getTrendingIssues = asyncHandler(async (req, res) => {
  const { community, limit = 6 } = req.query;

  const filter = {};
  if (community) filter.community = community;

  const issues = await Issue.find(filter)
    .populate("community", "name")
    .sort("-supportCount -createdAt")
    .limit(Number(limit));

  res.json({ issues });
});

// @desc   Search issues by title/description
// @route  GET /api/issues/search
export const searchIssues = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return errorResponse(res, "A search query 'q' is required", 400);
  }

  const issues = await Issue.find({
    $or: [
      { title: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
    ],
  })
    .populate("community", "name")
    .sort("-createdAt");

  res.json({ issues });
});

// @desc   Save/bookmark an issue
// @route  POST /api/issues/:id/save
export const saveIssue = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) {
    return errorResponse(res, "Issue not found", 404);
  }

  await req.user.updateOne({ $addToSet: { savedIssues: issue._id } });

  res.json({ message: "Issue saved" });
});

// @desc   Unsave/remove bookmark
// @route  DELETE /api/issues/:id/save
export const unsaveIssue = asyncHandler(async (req, res) => {
  await req.user.updateOne({ $pull: { savedIssues: req.params.id } });

  res.json({ message: "Issue removed from saved" });
});

// @desc   Get the logged-in user's saved/bookmarked issues
// @route  GET /api/issues/saved
export const getSavedIssues = asyncHandler(async (req, res) => {
  const user = await req.user.populate({
    path: "savedIssues",
    populate: { path: "community", select: "name" },
  });

  res.json({ issues: user.savedIssues });
});
