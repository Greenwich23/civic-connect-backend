import express from "express";
import representativeApplicationReviewRoutes from "./representativeApplicationReview.routes.js";
import userManagementRoutes from "./userManagement.routes.js";
import moderationRoutes from "./moderation.routes.js";
import communityManagementRoutes from "./communityManagement.routes.js";
import platformStatsRoutes from "./platformStats.routes.js";

const router = express.Router();

// All admin routes — each sub-router applies protect + authorize("admin")
router.use(
  "/representative-applications",
  representativeApplicationReviewRoutes,
);
router.use("/users", userManagementRoutes);
router.use("/moderation", moderationRoutes);
router.use("/communities", communityManagementRoutes);
router.use("/stats", platformStatsRoutes);

export default router;
