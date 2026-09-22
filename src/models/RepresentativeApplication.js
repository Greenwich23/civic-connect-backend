import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    applicationType: {
      type: String,
      enum: ["found_new_community", "represent_existing"],
      required: true,
    },

    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
    },

    proposedCommunityName: {
      type: String,
      trim: true,
    },

    proposedParent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
    },

    statement: {
      type: String,
      required: true,
    },

    passportPhotoUrl: {
      type: String,
      required: true,
    },

    nin: {
      type: String,
      required: true,
    },

    phoneNumber: {
      type: String,
      required: true,
    },

    proofOfResidenceUrl: String,

    yearsInCommunity: {
      type: String,
      enum: [
        "Less than 1 year",
        "1–2 years",
        "3–5 years",
        "6–10 years",
        "More than 10 years",
      ],
    },

    supporterCount: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
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

applicationSchema.pre("validate", function () {
  if (this.applicationType === "found_new_community") {
    if (!this.proposedCommunityName || !this.proposedParent) {
      throw new Error(
        "proposedCommunityName and proposedParent are required when founding a new community.",
      );
    }
  }

  if (this.applicationType === "represent_existing") {
    if (!this.community) {
      throw new Error(
        "community is required when applying to represent an existing community.",
      );
    }
  }
});

const RepresentativeApplication = mongoose.model(
  "RepresentativeApplication",
  applicationSchema,
);

export default RepresentativeApplication;
