import Issue from "../../models/Issues.js";
import User from "../../models/User.js";
import Community from "../../models/Community.js";
import asyncHandler from "../../utils/asyncHandler.js";

// @desc   Public headline numbers for the landing-page impact section
// @route  GET /api/public/stats
export const getPublicStats = asyncHandler(async (req, res) => {
  const [issuesReported, issuesResolved, citizens, communities] =
    await Promise.all([
      Issue.countDocuments(),
      Issue.countDocuments({ status: "resolved" }),
      User.countDocuments({ role: "citizen" }),
      Community.countDocuments({ level: "community" }),
    ]);

  res.json({ issuesReported, issuesResolved, citizens, communities });
});
