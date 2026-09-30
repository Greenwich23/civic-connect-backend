import User from "../models/User.js";

/**
 * Shared by admin/representativeApplicationReview.controller.js's
 * removeRepresentative and admin/representativeReport.controller.js's
 * reviewReport, so the two entry points that can strip a representative's
 * status can't drift out of sync.
 */
export const revokeRepresentativeStatus = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    return { error: "User not found", status: 404 };
  }

  if (user.role !== "representative") {
    return { error: "This user is not a representative", status: 400 };
  }

  user.role = "citizen";
  user.representativeInfo.isActive = false;
  user.representativeInfo.isVerifiedOfficial = false;
  await user.save();

  return { user };
};
