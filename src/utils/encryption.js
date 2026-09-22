import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended IV length for GCM
const KEY = crypto.scryptSync(process.env.ENCRYPTION_SECRET, "salt", 32);
// derives a fixed 32-byte key from your .env secret

/**
 * Encrypts a plain text string (e.g. a NIN).
 * Returns a single string combining iv + authTag + ciphertext, so it's easy to store as one field.
 */
export function encrypt(plainText) {
  if (!plainText) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(String(plainText), "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Store as: iv:authTag:ciphertext (all hex-encoded)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a string produced by encrypt().
 */
export function decrypt(encryptedString) {
  if (!encryptedString) return null;

  const [ivHex, authTagHex, encryptedHex] = encryptedString.split(":");
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Invalid encrypted string format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Masks a NIN for safe display, e.g. in API responses to non-admins.
 * "12345678901" -> "•••••••8901"
 */
export function maskNIN(nin) {
  if (!nin || nin.length < 4) return "••••••••••";
  const lastFour = nin.slice(-4);
  return "•".repeat(nin.length - 4) + lastFour;
}
