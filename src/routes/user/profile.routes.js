import express from "express";
import * as profileController from "../../controllers/user/profile.controller.js";
import { protect } from "../../middleware/auth.js";
import { uploadAvatar } from "../../middleware/uploadMiddleware.js";

const router = express.Router();

router.patch(
  "/me",
  protect,
  uploadAvatar.single("avatar"),
  profileController.updateProfile,
);

export default router;
