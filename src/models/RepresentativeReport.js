import mongoose from "mongoose";

const representativeReportSchema = new mongoose.Schema(
  {
    reportedRepresentative: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

    reason: {
      type: String,
      enum: [
        "inactive",
        "inappropriate_conduct",
        "false_resolution",
        "identity_concern",
        "other",
      ],
      required: true,
    },

    details: {
      type: String,
      required: true,
    },

    relatedIssue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Issue",
    },

    status: {
      type: String,
      enum: ["pending", "reviewed", "dismissed"],
      default: "pending",
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewNote: String,
    reviewedAt: Date,
  },
  { timestamps: true },
);

const RepresentativeReport = mongoose.model(
  "RepresentativeReport",
  representativeReportSchema,
);

export default RepresentativeReport;
