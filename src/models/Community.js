import mongoose from "mongoose";

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    level: {
      type: String,
      enum: ["city", "community"],
      required: true,
    },

    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "unrepresented"],
      default: "unrepresented",
    },

    foundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

const Community = mongoose.model("Community", communitySchema);

export default Community;
