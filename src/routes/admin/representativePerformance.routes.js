import express from "express";
import * as representativePerformanceController from "../../controllers/admin/representativePerformance.controller.js";
import { protect, authorize } from "../../middleware/auth.js";

const router = express.Router();

router.use(protect, authorize("admin"));

router.get("/", representativePerformanceController.getRepresentativePerformance);
router.get(
  "/:userId/issues",
  representativePerformanceController.getRepresentativeResolvedIssues,
);

export default router;
