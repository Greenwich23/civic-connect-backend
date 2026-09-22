import authRoutes from "./auth.routes.js";
import communityRoutes from "./community.routes.js";
import issueRoutes from "./issue.routes.js";
import commentRoutes from "./comment.routes.js";
import proposalRoutes from "./proposal.routes.js";
import voteRoutes from "./votes.routes.js";
import proposalStandaloneRoutes from "./proposalStandalone.routes.js";
import notificationRoutes from "./notification.routes.js";
import profileRoutes from "./profile.routes.js";
import representativeRoutes from "./representativeApplication.routes.js";

import express from "express";

const router = express.Router();

// Public routes - NO authentication needed

// export default router;
router.use("/auth", authRoutes);
router.use("/communities", communityRoutes);
router.use("/issues/:issueId/proposals", proposalRoutes);
router.use("/proposals", proposalStandaloneRoutes);
router.use("/issues", issueRoutes);
router.use("/", commentRoutes);
router.use("/votes", voteRoutes);
router.use("/notifications", notificationRoutes);
router.use("/profile", profileRoutes);
router.use("/representative-applications", representativeRoutes);

export default router;
