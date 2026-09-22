import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
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

    type: {
      type: String,
      enum: [
        "area_council",
        "government_department",
        "government_agency",
        "utility",
        "public_institution",
        "other",
      ],
      required: true,
    },

    categories: [
      {
        type: String,
        required: true,
      },
    ],

    description: String,
    logoUrl: String,
    contactPhone: String,

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true },
);

const Organization = mongoose.model("Organization", organizationSchema);

export default Organization;
