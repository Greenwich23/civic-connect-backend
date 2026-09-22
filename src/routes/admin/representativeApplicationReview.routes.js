import express from "express";
import * as reviewController from "../../controllers/admin/representativeApplicationReview.controller.js";
import { protect, authorize } from "../../middleware/auth.js";

const router = express.Router();

router.use(protect, authorize("admin"));

router.get("/", reviewController.getPendingApplications);

// Specific routes MUST come before "/:id" to avoid being swallowed by it
router.patch(
  "/representatives/:userId/remove",
  reviewController.removeRepresentative,
);

router.get("/:id", reviewController.getApplicationById);
router.patch("/:id/review", reviewController.reviewApplication);

export default router;
