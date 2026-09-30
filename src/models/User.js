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
      // "super_admin" is the one bootstrapped account (see seedAdmin.js)
      // that can create and manage other "admin" accounts. Regular admins
      // never see or act on admin-tier accounts — see
      // controllers/admin/userManagement.controller.js and
      // controllers/admin/adminManagement.controller.js.
      enum: ["citizen", "representative", "admin", "super_admin"],
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

      // Set only when an admin has reviewed proof of an actual local
      // government/council affiliation (see RepresentativeApplication's
      // claimsOfficialStatus) — distinct from just being an approved
      // representative, which anyone in the community can become.
      isVerifiedOfficial: {
        type: Boolean,
        default: false,
      },

      officialTitle: String,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    savedIssues: [{ type: mongoose.Schema.Types.ObjectId, ref: "Issue" }],

    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    otpCode: String,
    otpExpiresAt: Date,

    resetPasswordToken: String,
    resetPasswordExpiresAt: Date,
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

export default User;
