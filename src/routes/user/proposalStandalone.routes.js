import express from "express";
import * as proposalController from "../../controllers/user/proposal.controller.js";
// import { getCommunityProposals } from "../../controllers/user/proposal.controller.js";
import protect from "../../middleware/auth.js";

const router = express.Router();

router.get("/community", protect, proposalController.getCommunityProposals);
router.get("/:id", proposalController.getProposalById);

export default router;
