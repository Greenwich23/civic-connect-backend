import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "new_support",
        "new_comment",
        "proposal_voting_started",
        "status_updated",
        "issue_resolved",
        "application_approved",
        "application_rejected",
        "new_message",
        "resolution_disputed",
        "representative_report_reviewed",
        "representative_removed",
      ],
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    relatedIssue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Issue",
    },

    relatedConversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
