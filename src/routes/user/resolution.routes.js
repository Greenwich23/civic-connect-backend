import express from "express";
import * as resolutionController from "../../controllers/user/resolution.controller.js";
import { protect } from "../../middleware/auth.js";
import { uploadResolutionPhoto } from "../../middleware/uploadMiddleware.js";

const router = express.Router({ mergeParams: true });

// Nested under /api/issues/:issueId/resolution
router.get("/mine", protect, resolutionController.getMyFeedback);
router.get("/", resolutionController.getResolutionStats);
router.post(
  "/",
  protect,
  uploadResolutionPhoto.single("photo"),
  resolutionController.submitFeedback,
);

export default router;
