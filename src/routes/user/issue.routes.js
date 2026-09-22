import express from "express";
import * as issueController from "../../controllers/user/issue.controller.js";
import { protect } from "../../middleware/auth.js";
import { uploadIssueEvidence } from "../../middleware/uploadMiddleware.js";
import { authorize } from "../../middleware/auth.js";
import { updateIssueStatus } from "../../controllers/user/representative.controller.js";

const router = express.Router();

// Static/specific routes MUST come before "/:id" to avoid being swallowed by it
router.get("/mine", protect, issueController.getMyIssues);
router.get("/saved", protect, issueController.getSavedIssues);
router.get("/trending", issueController.getTrendingIssues);
router.get("/search", issueController.searchIssues);

router.get("/", issueController.getAllIssues);
router.post(
  "/",
  protect,
  uploadIssueEvidence.array("images", 5),
  issueController.createIssue,
);

router.get("/:id", issueController.getIssueById);
router.post("/:id/save", protect, issueController.saveIssue);
router.delete("/:id/save", protect, issueController.unsaveIssue);

router.patch(
  "/:id/status",
  protect,
  authorize("representative"),
  updateIssueStatus,
);

export default router;
