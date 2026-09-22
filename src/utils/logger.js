import { createLogger, format, transports } from "winston";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { combine, timestamp, printf, colorize, errors } = format;

// ─── custom log format ────────────────────────────────────────────────────────

const logFormat = printf(({ level, message, timestamp, stack }) => {
  // if there's a stack trace (from an Error), show it below the message
  return stack
    ? `[${timestamp}] ${level}: ${message}\n${stack}`
    : `[${timestamp}] ${level}: ${message}`;
});

// ─── logger instance ──────────────────────────────────────────────────────────

const logger = createLogger({
  level: process.env.NODE_ENV === "production" ? "warn" : "debug",

  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }), // capture stack traces from Error objects
    logFormat,
  ),

  transports: [
    // always log to console
    new transports.Console({
      format: combine(
        colorize({ all: true }), // colours in terminal
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        errors({ stack: true }),
        logFormat,
      ),
    }),

    // log warnings and errors to a file in production
    new transports.File({
      filename: path.join(__dirname, "../../logs/error.log"),
      level: "error",
    }),

    new transports.File({
      filename: path.join(__dirname, "../../logs/combined.log"),
    }),
  ],

  // don't crash the server on unhandled exceptions — log them instead
  exceptionHandlers: [
    new transports.File({
      filename: path.join(__dirname, "../../logs/exceptions.log"),
    }),
  ],
});

export default logger;

// ─── convenience wrappers ─────────────────────────────────────────────────────

export const logInfo = (message) => logger.info(message);
export const logWarn = (message) => logger.warn(message);
export const logError = (message, error) => {
  if (error instanceof Error) {
    logger.error(message, error); // passes the Error so winston captures the stack
  } else {
    logger.error(`${message}${error ? ` — ${error}` : ""}`);
  }
};
export const logDebug = (message) => logger.debug(message);
