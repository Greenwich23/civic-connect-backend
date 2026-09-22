import express from "express";
import * as authController from "../../controllers/user/auth.controller.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/logout", protect, authController.logout);
router.get("/me", protect, authController.getCurrentUser);
router.patch("/password", protect, authController.updatePassword);
router.patch("/join-community", protect, authController.joinCommunity);

export default router;
