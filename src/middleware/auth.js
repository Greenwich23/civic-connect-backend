// middleware/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { errorResponse } from "../utils/apiResponse.js";

export const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return errorResponse(res, "Not authenticated. Please log in.", 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return errorResponse(res, "User no longer exists", 401);
    }

    if (!user.isActive) {
      return errorResponse(res, "Your account has been deactivated", 403);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return errorResponse(res, "Invalid token. Please log in again.", 401);
    }
    if (error.name === "TokenExpiredError") {
      return errorResponse(
        res,
        "Your session has expired. Please log in again.",
        401,
      );
    }
    return errorResponse(res, error.message);
  }
};

// Generic role-based access middleware — pass one or more allowed roles
// e.g. authorize("admin"), authorize("representative"), authorize("admin", "representative")
//
// "super_admin" is a strict superset of "admin" — anywhere a route accepts
// "admin", a super_admin is let through too, without every admin route
// needing to list both roles explicitly. Routes that must be super_admin-only
// (managing other admin accounts) simply never list "admin" as allowed.
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, "Not authenticated. Please log in.", 401);
    }

    const isAllowed =
      allowedRoles.includes(req.user.role) ||
      (req.user.role === "super_admin" && allowedRoles.includes("admin"));

    if (!isAllowed) {
      return errorResponse(
        res,
        "Access denied. Insufficient permissions.",
        403,
      );
    }

    next();
  };
};

export default protect;
