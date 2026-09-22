import express from "express";
import * as userManagementController from "../../controllers/admin/userManagement.controller.js";
import { protect, authorize } from "../../middleware/auth.js";

const router = express.Router();

router.use(protect, authorize("admin"));

router.get("/", userManagementController.getAllUsers);
router.get("/:id", userManagementController.getUserById);
router.patch("/:id/deactivate", userManagementController.deactivateUser);
router.patch("/:id/reactivate", userManagementController.reactivateUser);

export default router;
