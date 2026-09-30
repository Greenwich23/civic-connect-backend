import express from "express";
import rateLimit from "express-rate-limit";
import { sendContactMessage } from "../../controllers/user/contact.controller.js";
import {
  contactValidation,
  validate,
} from "../../middleware/validateRequest.js";

const router = express.Router();

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many messages sent. Please try again later.",
  },
});

router.post("/", contactLimiter, contactValidation, validate, sendContactMessage);

export default router;
