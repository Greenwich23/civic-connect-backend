import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./src/models/User.js";

dotenv.config();

// One-off migration: isEmailVerified didn't exist before the OTP-verification
// feature was added, so every account created before that point reads as
// isEmailVerified: false (Mongoose applies the schema default to documents
// that are missing the field) and gets wrongly blocked at login, asked to
// verify an email that was never part of their signup. This grandfathers in
// every account that predates the feature — they already proved their email
// works by using the app — so only genuinely new signups from now on go
// through OTP verification. Safe to run again later; it only touches
// accounts still sitting at isEmailVerified: false/missing.
const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected...");

    const result = await User.updateMany(
      { isEmailVerified: { $ne: true } },
      { $set: { isEmailVerified: true } },
    );

    console.log(`Grandfathered ${result.modifiedCount} existing account(s) as verified.`);

    await mongoose.disconnect();
    console.log("Done. Disconnected.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

run();
