import bcrypt from "bcryptjs";
import User from "../../models/User.js";
import RepresentativeApplication from "../../models/RepresentativeApplication.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  generateOtp,
  otpExpiryTime,
} from "../../utils/generateToken.js";
import asyncHandler from "../../utils/asyncHandler.js";

// @desc   Register a new citizen account
// @route  POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, community } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res
      .status(400)
      .json({ message: "An account with this email already exists" });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    community: community || null,
  });

  const token = generateAccessToken(user._id, user.role);

  res.status(201).json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      community: user.community,
    },
  });
});

// @desc   Login
// @route  POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).populate("community", "name");

  if (!user || !user.isActive) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const token = generateAccessToken(user._id, user.role);

  res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      community: user.community,
      representativeInfo: user.representativeInfo,
    },
  });
});

// @desc   Get logged-in user's own data, plus onboarding/application state
// @route  GET /api/auth/me
export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select("-password")
    .populate("community", "name")
    .populate("representativeInfo.community", "name");

  const application = await RepresentativeApplication.findOne({
    applicant: user._id,
    status: { $in: ["pending", "rejected"] },
  }).sort("-createdAt");

  res.json({
    user,
    pendingApplication: application || null,
  });
});

// @desc   Update password
// @route  PATCH /api/auth/password
export const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id);
  const isMatch = await bcrypt.compare(currentPassword, user.password);

  if (!isMatch) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  await user.save();

  res.json({ message: "Password updated successfully" });
});

// @desc   Join a community
// @route  PATCH /api/auth/join-community
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
  )
    .select("-password")
    .populate("community", "name");

  res.json({
    message: `You've joined ${community.name}`,
    user,
  });
});

// @desc   Logout — stateless JWT, mostly a client-side action
// @route  POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  res.json({ message: "Logged out successfully" });
});
