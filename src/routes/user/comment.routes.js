import express from "express";

import {
  createComment,
  getIssueComments,
  getCommentById,
  replyToComment,
  getCommentReplies,
  updateComment,
  deleteComment,
  reportComment,
  pinComment,
  unpinComment,
} from "../../controllers/user/comment.controller.js";

import protect from "../../middleware/auth.js";

const router = express.Router();

/*
=========================================================
ISSUE COMMENTS
=========================================================
*/

// Get all comments for an issue
router.get("/issues/:issueId/comments", protect, getIssueComments);

// Post a comment
router.post("/issues/:issueId/comments", protect, createComment);

/*
=========================================================
SINGLE COMMENT
=========================================================
*/

// Get one comment
router.get("/comments/:commentId", protect, getCommentById);

// Edit comment
router.put("/comments/:commentId", protect, updateComment);

// Delete comment
router.delete("/comments/:commentId", protect, deleteComment);

/*
=========================================================
REPLIES
=========================================================
*/

// Reply to a comment
router.post("/comments/:commentId/replies", protect, replyToComment);

// Get replies
router.get("/comments/:commentId/replies", protect, getCommentReplies);

/*
=========================================================
PINNING (representative announcements)
=========================================================
*/

// Pin a comment
router.post("/comments/:commentId/pin", protect, pinComment);

// Unpin a comment
router.delete("/comments/:commentId/pin", protect, unpinComment);

/*
=========================================================
MODERATION
=========================================================
*/

// Report comment
router.post("/comments/:commentId/report", protect, reportComment);

export default router;
