import mongoose from "mongoose";

const resolutionSchema = new mongoose.Schema(
  {
    issue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Issue",
      required: true,
    },

    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },

    verdict: {
      type: String,
      enum: ["fixed", "partially_fixed", "still_exists"],
      required: true,
    },

    comment: String,
    photoUrl: String,
  },
  { timestamps: true },
);

resolutionSchema.index({ issue: 1, submittedBy: 1 }, { unique: true });

const Resolution = mongoose.model("Resolution", resolutionSchema);

export default Resolution;
