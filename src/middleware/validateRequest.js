import { validationResult, body, param } from "express-validator";
import { errorResponse } from "../utils/apiResponse.js";

// ─── run this after your validation chain to catch any errors ─────────────────
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return errorResponse(
      res,
      "Validation failed",
      400,
      errors.array().map((e) => ({ field: e.path, message: e.msg })),
    );
  }
  next();
};

// ─── reusable validation chains ───────────────────────────────────────────────

export const registerValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 30 })
    .withMessage("Name must be between 2 and 30 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number"),
];

export const loginValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email"),

  body("password").notEmpty().withMessage("Password is required"),
];

export const otpValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email"),

  body("otp")
    .notEmpty()
    .withMessage("OTP is required")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits")
    .isNumeric()
    .withMessage("OTP must contain only numbers"),
];

export const addressValidation = [
  body("fullName")
    .notEmpty()
    .withMessage("Full name is required")
    .isLength({ min: 2 })
    .withMessage("Full name must be at least 2 characters")
    .trim(),

  body("phone")
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^\+?[\d\s\-]{7,15}$/)
    .withMessage("Please enter a valid phone number"),

  body("street").notEmpty().withMessage("Street address is required").trim(),

  body("city").notEmpty().withMessage("City is required").trim(),

  // body("state").notEmpty().withMessage("State is required").trim(),

  body("zipCode").notEmpty().withMessage("Zip code is required").trim(),

  body("country").optional().trim().default("Nigeria"),

  body("label")
    .optional()
    .isIn(["home", "work", "other"])
    .withMessage("Label must be home, work, or other")
    .default("home"),

  body("isDefault")
    .optional()
    .isBoolean()
    .withMessage("isDefault must be a boolean"),
];

export const reviewValidation = [
  body("rating")
    .notEmpty()
    .withMessage("Rating is required")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),

  body("comment")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Review must not exceed 1000 characters"),
];

export const productValidation = [
  body("name").trim().notEmpty().withMessage("Product name is required"),
  body("description").trim().notEmpty().withMessage("Description is required"),
  body("price")
    .notEmpty()
    .withMessage("Price is required")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),
  body("stock")
    .notEmpty()
    .withMessage("Stock is required")
    .isInt({ min: 0 })
    .withMessage("Stock must be a positive number"),
  body("category").notEmpty().withMessage("Category is required"),
];

// middleware/validateRequest.js - Add this

export const contactValidation = [
  body("name")
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2 })
    .withMessage("Name must be at least 2 characters")
    .trim(),

  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email address")
    .normalizeEmail(),

  body("subject")
    .notEmpty()
    .withMessage("Subject is required")
    .isLength({ min: 3 })
    .withMessage("Subject must be at least 3 characters")
    .trim(),

  body("message")
    .notEmpty()
    .withMessage("Message is required")
    .isLength({ min: 10 })
    .withMessage("Message must be at least 10 characters")
    .trim(),
];

export const couponValidation = [
  body("code").trim().notEmpty().withMessage("Coupon code is required"),
  body("type")
    .notEmpty()
    .withMessage("Coupon type is required")
    .isIn(["percentage", "fixed"])
    .withMessage("Type must be percentage or fixed"),
  body("value")
    .notEmpty()
    .withMessage("Discount value is required")
    .isFloat({ min: 0 })
    .withMessage("Value must be a positive number"),
  body("expiresAt")
    .notEmpty()
    .withMessage("Expiry date is required")
    .isISO8601()
    .withMessage("Invalid date format"),
];

export const objectIdValidation = (paramName) => [
  param(paramName)
    .notEmpty()
    .withMessage(`${paramName} is required`)
    .isMongoId()
    .withMessage(`Invalid ${paramName}`),
];
