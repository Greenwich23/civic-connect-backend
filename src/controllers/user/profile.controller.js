import User from "../../models/User.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";

// @desc   Update the logged-in user's own profile (name, avatar)
// @route  PATCH /api/profile/me
export const updateProfile = asyncHandler(async (req, res) => {
  const { name } = req.body;

  const updates = {};

  if (name?.trim()) {
    updates.name = name.trim();
  }

  // If an avatar file was uploaded via multer/Cloudinary
  if (req.file?.path) {
    updates.avatarUrl = req.file.path;
  }

  if (Object.keys(updates).length === 0) {
    return errorResponse(res, "No valid fields provided to update", 400);
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
  })
    .select("-password")
    .populate("community", "name");

  res.json({ user });
});
