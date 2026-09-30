import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse } from "../../utils/apiResponse.js";
import { sendContactEmail } from "../../utils/sendEmail.js";

// @desc   Send a contact-form message to the CivicPulse team
// @route  POST /api/contact
export const sendContactMessage = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;

  await sendContactEmail({ name, email, subject, message });

  return successResponse(res, "Message sent successfully");
});
