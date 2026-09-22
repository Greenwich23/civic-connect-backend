import express from "express";
import * as platformStatsController from "../../controllers/admin/platformStats.controller.js";
import { protect, authorize } from "../../middleware/auth.js";

const router = express.Router();

router.use(protect, authorize("admin"));

router.get("/overview", platformStatsController.getPlatformOverview);
router.get("/communities", platformStatsController.getCommunityBreakdown);

export default router;
