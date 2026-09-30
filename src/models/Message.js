import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
    },

    // Set true once the other party in the conversation has opened it —
    // a 1:1 thread only ever has one "other party", so a plain boolean
    // (rather than a per-user read list, like Comments needs) is enough.
    isRead: {
      type: Boolean,
      default: false,
    },

    moderationStatus: {
      type: String,
      enum: ["visible", "hidden", "flagged"],
      default: "visible",
    },

    reportReason: {
      type: String,
      enum: ["spam", "harassment", "misinformation", "off_topic", "other"],
    },

    reportDetails: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true },
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
