import express from "express";
import * as representativeReportController from "../../controllers/admin/representativeReport.controller.js";
import { protect, authorize } from "../../middleware/auth.js";

const router = express.Router();

router.use(protect, authorize("admin"));

router.get("/", representativeReportController.getReports);
router.get("/:id", representativeReportController.getReportById);
router.patch("/:id/review", representativeReportController.reviewReport);

export default router;
