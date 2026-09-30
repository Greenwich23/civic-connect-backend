import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../../models/User.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { errorResponse } from "../../utils/apiResponse.js";

// Super_admin-only — managing the admin tier itself. Deliberately separate
// from userManagement.controller.js so a regular admin never has any path,
// even by id or query param, to see or act on another admin's account.
//
// This only manages the "admin" role, never "super_admin" — there is
// exactly one super_admin, bootstrapped by seedAdmin.js, not created or
// changed through the API.

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const clampPage = (value) => Math.max(parseInt(value) || 1, 1);
const clampLimit = (value) => Math.min(Math.max(parseInt(value) || 20, 1), 100);

// @desc   List admin accounts (paginated, searchable by name/email)
// @route  GET /api/admin/admins?search=&isActive=&page=&limit=
export const getAllAdmins = asyncHandler(async (req, res) => {
  const { search, isActive } = req.query;

  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit);

  const filter = { role: "admin" };

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

  const [admins, total] = await Promise.all([
    User.find(filter)
      .select("-password")
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  res.json({
    admins,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// @desc   Create a new admin account — its own email/password, like any
//         other CivicPulse account, so actions stay individually attributable
// @route  POST /api/admin/admins
// @body   { name, email, password }
export const createAdmin = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name?.trim() || !email?.trim() || !password) {
    return errorResponse(res, "name, email and password are required", 400);
  }

  if (password.length < 8) {
    return errorResponse(res, "Password must be at least 8 characters", 400);
  }

  const existing = await User.findOne({ email: email.trim().toLowerCase() });

  if (existing) {
    return errorResponse(res, "An account with this email already exists", 400);
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const admin = await User.create({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: hashedPassword,
    role: "admin",
    isEmailVerified: true,
  });

  res.status(201).json({
    message: "Admin account created",
    admin: {
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      isActive: admin.isActive,
      createdAt: admin.createdAt,
    },
  });
});

// Shared by deactivateAdmin / reactivateAdmin
const setAdminActive = (isActive) =>
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return errorResponse(res, "Invalid admin id", 400);
    }

    const admin = await User.findOne({
      _id: req.params.id,
      role: "admin",
    }).select("-password");

    if (!admin) {
      return errorResponse(res, "Admin not found", 404);
    }

    if (admin.isActive === isActive) {
      return errorResponse(
        res,
        `Admin is already ${isActive ? "active" : "deactivated"}`,
        400,
      );
    }

    admin.isActive = isActive;
    await admin.save();

    res.json({
      message: `Admin ${isActive ? "reactivated" : "deactivated"}`,
      admin,
    });
  });

// @desc   Deactivate an admin account
// @route  PATCH /api/admin/admins/:id/deactivate
export const deactivateAdmin = setAdminActive(false);

// @desc   Reactivate a previously deactivated admin account
// @route  PATCH /api/admin/admins/:id/reactivate
export const reactivateAdmin = setAdminActive(true);
