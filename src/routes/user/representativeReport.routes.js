import express from "express";
import * as representativeReportController from "../../controllers/user/representativeReport.controller.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router();

router.post("/", protect, representativeReportController.reportRepresentative);
router.get("/mine", protect, representativeReportController.getMyReports);

export default router;
