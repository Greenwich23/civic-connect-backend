import mongoose from "mongoose";

const proposalSchema = new mongoose.Schema(
  {
    issue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Issue",
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    proposedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    supportCount: {
      type: Number,
      default: 0,
    },

    opposeCount: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["open_for_voting", "accepted", "rejected"],
      default: "open_for_voting",
    },
  },
  { timestamps: true },
);

const Proposal = mongoose.model("Proposal", proposalSchema);

export default Proposal;
