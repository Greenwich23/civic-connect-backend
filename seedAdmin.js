import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import User from "./src/models/User.js";

dotenv.config();

// Bootstraps the one super_admin account. Run once per environment:
//
//   SUPER_ADMIN_EMAIL=you@example.com SUPER_ADMIN_PASSWORD=somethingLong SUPER_ADMIN_NAME="Your Name" node seedAdmin.js
//
// Safe to run again later (e.g. to reset the password) — it updates the
// existing super_admin at that email instead of creating a duplicate. It
// never touches any other account, and never creates a plain "admin" —
// those are created by the super_admin from the admin panel once this
// account can log in.
const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected for seeding...");

    const name = process.env.SUPER_ADMIN_NAME?.trim() || "Super Admin";
    const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!email || !password) {
      console.error(
        "Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD (and optionally SUPER_ADMIN_NAME) " +
          "before running this script, e.g.:\n" +
          '  SUPER_ADMIN_EMAIL=you@example.com SUPER_ADMIN_PASSWORD=somethingLong SUPER_ADMIN_NAME="Your Name" node seedAdmin.js',
      );
      process.exit(1);
    }

    if (password.length < 8) {
      console.error("SUPER_ADMIN_PASSWORD must be at least 8 characters.");
      process.exit(1);
    }

    const existing = await User.findOne({ email });

    if (existing && existing.role !== "super_admin") {
      console.error(
        `An account already exists at ${email} with role "${existing.role}" — ` +
          "refusing to overwrite it. Use a different SUPER_ADMIN_EMAIL.",
      );
      process.exit(1);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    if (existing) {
      existing.name = name;
      existing.password = hashedPassword;
      existing.isActive = true;
      existing.isEmailVerified = true;
      await existing.save();
      console.log(`Updated existing super admin: ${email}`);
    } else {
      await User.create({
        name,
        email,
        password: hashedPassword,
        role: "super_admin",
        isActive: true,
        isEmailVerified: true,
      });
      console.log(`Created super admin: ${email}`);
    }

    await mongoose.disconnect();
    console.log("Done. Disconnected.");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
};

seed();
