import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    issue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Issue",
      required: true,
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      // required: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
    },

    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },

    moderationStatus: {
      type: String,
      enum: ["visible", "hidden", "flagged"],
      default: "visible",
    },

    // Lets a representative pin one of their own comments on an issue to
    // use as an announcement — see comment.controller.js pinComment.
    isPinned: {
      type: Boolean,
      default: false,
    },

    pinnedAt: Date,

    // Users who liked ("Helpful") this comment — one entry per user, so a
    // like can be toggled off and can't be counted twice.
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Reporting flags a comment for admin review (moderationStatus becomes
    // "flagged") but never hides it by itself — only an admin hiding it does.
    // reportReason/reportDetails hold the most recent report's context;
    // reportedBy/reportCount track how many distinct people have reported it,
    // so admins can triage by volume without any report auto-hiding content.
    reportReason: {
      type: String,
      enum: ["spam", "harassment", "misinformation", "off_topic", "other"],
    },

    reportDetails: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    reportedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    reportCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

const Comment = mongoose.model("Comment", commentSchema);

export default Comment;
