import express from "express";
import * as proposalController from "../../controllers/user/proposal.controller.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router({ mergeParams: true });

// Nested under /api/issues/:issueId/proposals
router.post("/", protect, proposalController.createProposal);
router.get("/", proposalController.getProposals);

export default router;
