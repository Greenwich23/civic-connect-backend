import express from "express";
import * as applicationController from "../../controllers/user/representativeApplication.controller.js";
import { protect } from "../../middleware/auth.js";
import { uploadRepresentativeDocs } from "../../middleware/uploadMiddleware.js";

const router = express.Router();

router.post(
  "/",
  protect,
  uploadRepresentativeDocs.fields([
    { name: "passportPhoto", maxCount: 1 },
    { name: "proofOfResidence", maxCount: 1 },
    { name: "officialDocument", maxCount: 1 },
  ]),
  applicationController.applyForRepresentative,
);

router.get("/mine", protect, applicationController.getMyApplication);
router.delete("/mine", protect, applicationController.withdrawApplication);

export default router;
