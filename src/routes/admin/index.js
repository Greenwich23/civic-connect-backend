import express from "express";
import representativeApplicationReviewRoutes from "./representativeApplicationReview.routes.js";
import userManagementRoutes from "./userManagement.routes.js";
import moderationRoutes from "./moderation.routes.js";
import communityManagementRoutes from "./communityManagement.routes.js";
import platformStatsRoutes from "./platformStats.routes.js";
import issueManagementRoutes from "./issueManagement.routes.js";
import adminManagementRoutes from "./adminManagement.routes.js";
import representativePerformanceRoutes from "./representativePerformance.routes.js";
import representativeReportRoutes from "./representativeReport.routes.js";

const router = express.Router();

// All admin routes — each sub-router applies protect + authorize("admin")
// (super_admin passes those too — see authorize() in middleware/auth.js),
// except /admins, which is authorize("super_admin") only.
router.use(
  "/representative-applications",
  representativeApplicationReviewRoutes,
);
router.use("/users", userManagementRoutes);
router.use("/moderation", moderationRoutes);
router.use("/communities", communityManagementRoutes);
router.use("/stats", platformStatsRoutes);
router.use("/issues", issueManagementRoutes);
router.use("/admins", adminManagementRoutes);
router.use("/representative-performance", representativePerformanceRoutes);
router.use("/representative-reports", representativeReportRoutes);

export default router;
