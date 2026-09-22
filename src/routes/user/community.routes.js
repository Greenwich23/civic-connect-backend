import express from "express";
import * as communityController from "../../controllers/user/community.controller.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router();

router.get("/", communityController.getAllCommunities);
router.get("/active", communityController.getActiveCommunities);
router.get("/joinable", communityController.getJoinableCommunities);
router.get("/check", communityController.checkCommunityNameExists);
router.get("/:id", communityController.getCommunityById);

router.patch("/join", protect, communityController.joinCommunity);
router.patch("/leave", protect, communityController.leaveCommunity);

export default router;
