import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    avatarUrl: String,

    role: {
      type: String,
      enum: ["citizen", "representative", "admin"],
      default: "citizen",
    },

    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
    },

    representativeInfo: {
      community: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Community",
      },

      appointedAt: Date,

      isActive: {
        type: Boolean,
        default: true,
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    savedIssues: [{ type: mongoose.Schema.Types.ObjectId, ref: "Issue" }],
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

export default User;
