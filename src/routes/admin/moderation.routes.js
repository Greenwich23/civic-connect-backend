import express from "express";
import * as moderationController from "../../controllers/admin/moderation.controller.js";
import { protect, authorize } from "../../middleware/auth.js";

const router = express.Router();

router.use(protect, authorize("admin"));

router.get("/comments/flagged", moderationController.getFlaggedComments);
router.patch("/comments/:id", moderationController.moderateComment);

router.get("/messages/flagged", moderationController.getFlaggedMessages);
router.patch("/messages/:id", moderationController.moderateMessage);

export default router;
