import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"CivicPulse" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
};

export const sendOtpEmail = async ({ to, name, otp }) => {
  await sendEmail({
    to,
    subject: "Verify your CivicPulse email",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0F766E;">Verify your email</h2>
        <p>Hi ${name},</p>
        <p>Use the code below to verify your email address and finish setting up your CivicPulse account:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #1E293B; margin: 24px 0;">${otp}</p>
        <p>This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
};

export const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  await sendEmail({
    to,
    subject: "Reset your CivicPulse password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0F766E;">Reset your password</h2>
        <p>Hi ${name},</p>
        <p>We got a request to reset your CivicPulse password. Click the link below to choose a new one:</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background: #0F766E; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Reset Password</a>
        </p>
        <p>This link expires in 30 minutes. If you didn't request this, you can safely ignore this email — your password won't change.</p>
      </div>
    `,
  });
};

const escapeHtml = (str = "") =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const sendContactEmail = async ({ name, email, subject, message }) => {
  const to = process.env.CONTACT_RECEIVER_EMAIL || process.env.SMTP_USER;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"CivicPulse" <${process.env.SMTP_USER}>`,
    to,
    replyTo: `"${String(name).replace(/["\r\n]/g, "")}" <${email}>`,
    subject: `[Contact] ${String(subject).replace(/[\r\n]/g, " ")}`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #0F766E;">New contact message</h2>
        <p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <p style="white-space: pre-wrap; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px;">${escapeHtml(message)}</p>
      </div>
    `,
  });
};
