import crypto from "crypto";
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
import { errorResponse } from "../../utils/apiResponse.js";
import { sendOtpEmail, sendPasswordResetEmail } from "../../utils/sendEmail.js";

// @desc   Register a new citizen account — unverified until the emailed
//         OTP is confirmed via verifyOtp, so no session token is issued yet
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

  const otp = generateOtp();

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    community: community || null,
    otpCode: otp,
    otpExpiresAt: otpExpiryTime(),
  });

  await sendOtpEmail({ to: user.email, name: user.name, otp });

  res.status(201).json({
    message: "Verification code sent to your email",
    email: user.email,
  });
});

// @desc   Verify the OTP sent at registration (or via resend), and log the
//         now-verified user in
// @route  POST /api/auth/verify-otp
export const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return errorResponse(res, "email and otp are required", 400);
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() });

  if (!user) {
    return errorResponse(res, "No account found with this email", 404);
  }

  if (user.isEmailVerified) {
    return errorResponse(res, "This email is already verified", 400);
  }

  if (!user.otpCode || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
    return errorResponse(res, "This code has expired. Request a new one.", 400);
  }

  if (user.otpCode !== otp) {
    return errorResponse(res, "Incorrect code", 400);
  }

  user.isEmailVerified = true;
  user.otpCode = undefined;
  user.otpExpiresAt = undefined;
  await user.save();

  const token = generateAccessToken(user._id, user.role);

  res.json({
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

// @desc   Resend a fresh OTP to an unverified account
// @route  POST /api/auth/send-otp
export const sendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return errorResponse(res, "email is required", 400);
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() });

  if (!user) {
    return errorResponse(res, "No account found with this email", 404);
  }

  if (user.isEmailVerified) {
    return errorResponse(res, "This email is already verified", 400);
  }

  const otp = generateOtp();
  user.otpCode = otp;
  user.otpExpiresAt = otpExpiryTime();
  await user.save();

  await sendOtpEmail({ to: user.email, name: user.name, otp });

  res.json({ message: "Verification code sent to your email" });
});

// @desc   Login
// @route  POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).populate({
    path: "community",
    select: "name parent",
    populate: { path: "parent", select: "name" },
  });

  if (!user || !user.isActive) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  if (!user.isEmailVerified) {
    return res.status(403).json({
      message: "Please verify your email before logging in",
      requiresVerification: true,
      email: user.email,
    });
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
    .populate({
      path: "community",
      select: "name parent",
      populate: { path: "parent", select: "name" },
    })
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

// @desc   Request a password reset link — always responds the same way
//         whether or not the email exists, so this can't be used to probe
//         which emails have accounts
// @route  POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return errorResponse(res, "email is required", 400);
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() });

  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    const resetUrl = `${process.env.CUSTOMER_URL || "https://civcpulse.netlify.app"}/reset-password?token=${token}`;

    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
    });
  }

  res.json({
    message:
      "If an account exists with that email, a password reset link has been sent",
  });
});

// @desc   Reset a password using the token emailed by forgotPassword
// @route  POST /api/auth/reset-password
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return errorResponse(res, "token and newPassword are required", 400);
  }

  if (newPassword.length < 8) {
    return errorResponse(res, "Password must be at least 8 characters", 400);
  }

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpiresAt: { $gt: new Date() },
  });

  if (!user) {
    return errorResponse(res, "This reset link is invalid or has expired", 400);
  }

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpiresAt = undefined;
  await user.save();

  res.json({ message: "Password reset successfully. You can now log in." });
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
