import express from "express";
import * as adminManagementController from "../../controllers/admin/adminManagement.controller.js";
import { protect, authorize } from "../../middleware/auth.js";

const router = express.Router();

// super_admin only — deliberately NOT authorize("admin"), so a regular
// admin gets a 403 here even though authorize("admin") elsewhere lets a
// super_admin through. This is the one route group that doesn't work the
// other way around.
router.use(protect, authorize("super_admin"));

router.get("/", adminManagementController.getAllAdmins);
router.post("/", adminManagementController.createAdmin);
router.patch("/:id/deactivate", adminManagementController.deactivateAdmin);
router.patch("/:id/reactivate", adminManagementController.reactivateAdmin);

export default router;
