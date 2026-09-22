import express from "express";
import * as notificationController from "../../controllers/user/notification.controller.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router();

router.get("/", protect, notificationController.getMyNotifications);
router.patch("/read-all", protect, notificationController.markAllAsRead);
router.patch("/:id/read", protect, notificationController.markAsRead);
router.delete("/", protect, notificationController.clearAllNotifications);
router.delete("/:id", protect, notificationController.deleteNotification);

export default router;
