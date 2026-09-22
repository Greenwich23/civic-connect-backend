import Issue from "../../models/Issues.js";
import User from "../../models/User.js";
import Community from "../../models/Community.js";
import RepresentativeApplication from "../../models/RepresentativeApplication.js";
import asyncHandler from "../../utils/asyncHandler.js";

// @desc   Platform-wide headline counts
// @route  GET /api/admin/stats/overview
export const getPlatformOverview = asyncHandler(async (req, res) => {
  const [
    totalIssues,
    resolvedIssues,
    totalUsers,
    activeRepresentatives,
    pendingApplications,
  ] = await Promise.all([
    Issue.countDocuments(),
    Issue.countDocuments({ status: "resolved" }),
    User.countDocuments(),
    User.countDocuments({
      role: "representative",
      "representativeInfo.isActive": true,
    }),
    RepresentativeApplication.countDocuments({ status: "pending" }),
  ]);

  res.json({
    overview: {
      totalIssues,
      resolvedIssues,
      totalUsers,
      activeRepresentatives,
      pendingApplications,
    },
  });
});

// @desc   Per-community issue count and resolution rate
// @route  GET /api/admin/stats/communities
export const getCommunityBreakdown = asyncHandler(async (req, res) => {
  const communities = await Community.aggregate([
    { $match: { level: "community" } },
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
    {
      $addFields: {
        // percentage to 1 decimal; null (not 0) when there are no issues to rate
        resolutionRate: {
          $cond: [
            { $gt: ["$issueCount", 0] },
            {
              $round: [
                { $multiply: [{ $divide: ["$resolvedCount", "$issueCount"] }, 100] },
                1,
              ],
            },
            null,
          ],
        },
      },
    },
    { $project: { issues: 0 } },
    { $sort: { name: 1 } },
  ]);

  await Community.populate(communities, { path: "parent", select: "name" });

  res.json({ communities });
});
