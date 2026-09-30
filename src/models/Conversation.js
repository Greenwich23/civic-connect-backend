import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    citizen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // The conversation is scoped to a community, not a specific
    // representative — that way it keeps working across a change of
    // representative instead of going stale if the rep is replaced.
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
    },

    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

// One open thread per citizen per community — reopened, never duplicated
conversationSchema.index({ citizen: 1, community: 1 }, { unique: true });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
