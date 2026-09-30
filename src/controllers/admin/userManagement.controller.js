import mongoose from "mongoose";
import User from "../../models/User.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";

// This controller only ever deals with citizen/representative accounts.
// Admin-tier accounts (admin, super_admin) are managed exclusively through
// adminManagement.controller.js, which only a super_admin can reach — a
// regular admin can't see or act on another admin through here even if
// they guess an id or pass ?role=admin.
const MANAGEABLE_ROLES = ["citizen", "representative"];
const ADMIN_ROLES = ["admin", "super_admin"];

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// @desc   List users (paginated, filterable by role/isActive, searchable by name/email)
// @route  GET /api/admin/users?role=citizen&isActive=true&search=jane&page=1&limit=20
export const getAllUsers = asyncHandler(async (req, res) => {
  const { role, isActive, search } = req.query;

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);

  const filter = { role: { $in: MANAGEABLE_ROLES } };

  if (role) {
    if (!MANAGEABLE_ROLES.includes(role)) {
      return errorResponse(
        res,
        `role must be one of: ${MANAGEABLE_ROLES.join(", ")}`,
        400,
      );
    }
    filter.role = role;
  }

  if (isActive !== undefined) {
    if (!["true", "false"].includes(isActive)) {
      return errorResponse(res, 'isActive must be "true" or "false"', 400);
    }
    filter.isActive = isActive === "true";
  }

  if (search?.trim()) {
    const pattern = { $regex: escapeRegex(search.trim()), $options: "i" };
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select("-password")
      .populate("community", "name")
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  res.json({
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// @desc   Get a single user's details
// @route  GET /api/admin/users/:id
export const getUserById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return errorResponse(res, "Invalid user id", 400);
  }

  const user = await User.findById(req.params.id)
    .select("-password")
    .populate("community", "name level");

  if (!user || ADMIN_ROLES.includes(user.role)) {
    return errorResponse(res, "User not found", 404);
  }

  res.json({ user });
});

// Shared by deactivateUser / reactivateUser
const setUserActive = (isActive) =>
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return errorResponse(res, "Invalid user id", 400);
    }

    if (!isActive && req.params.id === req.user._id.toString()) {
      return errorResponse(res, "You cannot deactivate your own account", 400);
    }

    const user = await User.findById(req.params.id).select("-password");

    if (!user || ADMIN_ROLES.includes(user.role)) {
      return errorResponse(res, "User not found", 404);
    }

    if (user.isActive === isActive) {
      return errorResponse(
        res,
        `User is already ${isActive ? "active" : "deactivated"}`,
        400,
      );
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      message: `User ${isActive ? "reactivated" : "deactivated"}`,
      user,
    });
  });

// @desc   Deactivate a user (blocks login and API access)
// @route  PATCH /api/admin/users/:id/deactivate
export const deactivateUser = setUserActive(false);

// @desc   Reactivate a previously deactivated user
// @route  PATCH /api/admin/users/:id/reactivate
export const reactivateUser = setUserActive(true);
