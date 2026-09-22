import dotenv from "dotenv";

dotenv.config();

const required = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const optional = (key, fallback = "") => {
  return process.env[key] || fallback;
};

// ─── SERVER ───────────────────────────────────────────────────────────────────

export const NODE_ENV = optional("NODE_ENV", "development");
export const PORT = optional("PORT", "5000");
export const IS_PRODUCTION = NODE_ENV === "production";
export const IS_DEVELOPMENT = NODE_ENV === "development";

// ─── DATABASE ─────────────────────────────────────────────────────────────────

export const MONGO_URI = required("MONGO_URI");

// ─── JWT ──────────────────────────────────────────────────────────────────────

export const JWT_SECRET = required("JWT_SECRET");
export const JWT_EXPIRES_IN = optional("JWT_EXPIRES_IN", "7d");
export const JWT_REFRESH_SECRET = optional("JWT_REFRESH_SECRET", JWT_SECRET);

// ─── CORS / FRONTEND URLS ─────────────────────────────────────────────────────

export const CUSTOMER_URL = optional("CUSTOMER_URL", "http://localhost:3000");
export const ADMIN_URL = optional("ADMIN_URL", "http://localhost:3001");

// ─── CLOUDINARY ───────────────────────────────────────────────────────────────

export const CLOUDINARY_CLOUD_NAME = required("CLOUDINARY_CLOUD_NAME");
export const CLOUDINARY_API_KEY = required("CLOUDINARY_API_KEY");
export const CLOUDINARY_API_SECRET = required("CLOUDINARY_API_SECRET");

// ─── EMAIL (NODEMAILER) ───────────────────────────────────────────────────────

export const EMAIL_HOST = optional("EMAIL_HOST", "smtp.gmail.com");
export const EMAIL_PORT = optional("EMAIL_PORT", "587");
export const EMAIL_USER = required("EMAIL_USER");
export const EMAIL_PASS = required("EMAIL_PASS");

// ─── SMS (TWILIO) ─────────────────────────────────────────────────────────────

export const TWILIO_ACCOUNT_SID = optional("TWILIO_ACCOUNT_SID");
export const TWILIO_AUTH_TOKEN = optional("TWILIO_AUTH_TOKEN");
export const TWILIO_PHONE_NUMBER = optional("TWILIO_PHONE_NUMBER");

// ─── STRIPE ───────────────────────────────────────────────────────────────────

export const STRIPE_SECRET_KEY = optional("STRIPE_SECRET_KEY");
export const STRIPE_WEBHOOK_SECRET = optional("STRIPE_WEBHOOK_SECRET");

// ─── RAZORPAY ─────────────────────────────────────────────────────────────────

export const RAZORPAY_KEY_ID = optional("RAZORPAY_KEY_ID");
export const RAZORPAY_KEY_SECRET = optional("RAZORPAY_KEY_SECRET");

// ─── CURRENCY ─────────────────────────────────────────────────────────────────

export const CURRENCY = optional("CURRENCY", "NGN");

// ─── VALIDATE ON STARTUP ──────────────────────────────────────────────────────
// this runs the moment env.js is imported anywhere in the app
// if anything required is missing the server refuses to start

const validateEnv = () => {
  const errors = [];

  // these are always required no matter what
  const alwaysRequired = [
    "MONGO_URI",
    "JWT_SECRET",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "EMAIL_USER",
    "EMAIL_PASS",
  ];

  alwaysRequired.forEach((key) => {
    if (!process.env[key]) {
      errors.push(`  ✗ ${key} is missing`);
    }
  });

  // in production, payment keys must also be present
  if (IS_PRODUCTION) {
    const productionRequired = [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "RAZORPAY_KEY_ID",
      "RAZORPAY_KEY_SECRET",
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
      "TWILIO_PHONE_NUMBER",
    ];

    productionRequired.forEach((key) => {
      if (!process.env[key]) {
        errors.push(`  ✗ ${key} is required in production`);
      }
    });
  }

  if (errors.length > 0) {
    console.error("\n❌ Environment validation failed:\n");
    errors.forEach((e) => console.error(e));
    console.error(
      "\nPlease check your .env file and make sure all required variables are set.\n",
    );
    process.exit(1); // stop the server — don't run with broken config
  }

  if (IS_DEVELOPMENT) {
    console.log("✅ Environment variables loaded successfully");
  }
};

validateEnv();
