import express from "express";
import * as messageController from "../../controllers/user/message.controller.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router();

router.post("/conversations", protect, messageController.startConversation);
router.get("/conversations", protect, messageController.getMyConversations);

router.get(
  "/conversations/:conversationId",
  protect,
  messageController.getConversationMessages,
);
router.post(
  "/conversations/:conversationId",
  protect,
  messageController.sendMessage,
);

router.post("/:messageId/report", protect, messageController.reportMessage);

export default router;
