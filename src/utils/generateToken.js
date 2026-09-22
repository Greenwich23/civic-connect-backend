import jwt from "jsonwebtoken";

/**
 * Generate a signed JWT access token
 * @param {string} userId - MongoDB user _id
 * @param {string} role - "customer" or "admin"
 * @returns {string} signed JWT
 */
export const generateAccessToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

/**
 * Generate a short-lived refresh token
 * Useful if you later add a token rotation / refresh endpoint
 * @param {string} userId
 * @returns {string} signed JWT
 */
export const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: "30d" },
  );
};

/**
 * Verify a JWT and return its decoded payload
 * Returns null instead of throwing so callers can handle gracefully
 * @param {string} token
 * @returns {object|null} decoded payload or null
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
};

/**
 * Generate a numeric OTP
 * @param {number} length - number of digits (default 6)
 * @returns {string} OTP string e.g. "482910"
 */
export const generateOtp = (length = 6) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
};

/**
 * Return the expiry Date object for an OTP
 * @param {number} minutes - how long until OTP expires (default 10)
 * @returns {Date}
 */
export const otpExpiryTime = (minutes = 10) => {
  return new Date(Date.now() + minutes * 60 * 1000);
};
