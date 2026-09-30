import mongoose from "mongoose";

const statusUpdateSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
    },

    message: String,

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const issueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      required: true,
    },

    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
    },

    images: [{ type: String }],

    status: {
      type: String,
      enum: [
        "reported",
        "under_review",
        "action_planned",
        "in_progress",
        "resolved",
      ],
      default: "reported",
    },

    statusHistory: [statusUpdateSchema],

    supportCount: {
      type: Number,
      default: 0,
    },

    opposeCount: {
      type: Number,
      default: 0,
    },

    resolvedAt: Date,

    // Admin-only moderation (e.g. spam or duplicate reports) — a hidden
    // issue disappears from every citizen-facing screen, but stays visible
    // and restorable in the admin panel. There's no citizen "report an
    // issue" flow (unlike Comments), so only an admin sets this.
    moderationStatus: {
      type: String,
      enum: ["visible", "hidden"],
      default: "visible",
    },
  },
  { timestamps: true },
);

const Issue = mongoose.model("Issue", issueSchema);

export default Issue;
