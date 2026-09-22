import express from "express";
import * as communityManagementController from "../../controllers/admin/communityManagement.controller.js";
import { protect, authorize } from "../../middleware/auth.js";

const router = express.Router();

router.use(protect, authorize("admin"));

router.post("/", communityManagementController.createCommunity);
router.patch("/:id", communityManagementController.updateCommunity);

export default router;
