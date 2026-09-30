import express from "express";
import * as issueManagementController from "../../controllers/admin/issueManagement.controller.js";
import { protect, authorize } from "../../middleware/auth.js";

const router = express.Router();

router.use(protect, authorize("admin"));

router.get("/", issueManagementController.getAllIssues);
router.get("/:id", issueManagementController.getIssueById);
router.patch("/:id/status", issueManagementController.updateIssueStatus);
router.patch("/:id/moderate", issueManagementController.moderateIssue);

export default router;
