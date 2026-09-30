import { errorResponse } from "../utils/apiResponse.js";

// must be used AFTER the protect middleware
// protect sets req.user, then this checks their role

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, "Not authenticated", 401);
  }

  if (req.user.role !== "admin" && req.user.role !== "super_admin") {
    return errorResponse(res, "Access denied. Admin privileges required.", 403);
  }

  next();
};

export default requireAdmin;
