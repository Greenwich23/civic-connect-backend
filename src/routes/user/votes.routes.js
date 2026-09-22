import express from "express";
import * as voteController from "../../controllers/user/vote.controller.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router();

router.post("/", protect, voteController.castVote);
router.delete("/:targetType/:targetId", protect, voteController.removeVote);
router.get(
  "/:targetType/:targetId/status",
  protect,
  voteController.getVoteStatus,
);

export default router;
