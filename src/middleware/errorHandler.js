// this must be registered LAST in app.js — after all routes
// Express recognises it as an error handler because it has 4 parameters (err, req, res, next)

const errorHandler = (err, req, res, next) => {
  // Cloudinary rejects with plain objects (not Error instances), so log the
  // whole thing rather than relying on .message/.stack
  console.error(`[ERROR] ${req.method} ${req.originalUrl}`, err);

  let statusCode = err.statusCode || err.http_code || 500;
  let message =
    err.message || err.error?.message || "Something went wrong on the server";

  // multer errors — file too large, too many files, unexpected field
  if (err.name === "MulterError") {
    statusCode = 400;
    message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Image is too large (max 5MB)"
        : err.code === "LIMIT_UNEXPECTED_FILE"
          ? "Too many images (max 5) or unexpected file field"
          : err.message;
  }

  // Cloudinary auth failures are our config problem, not the client's
  if (err.http_code === 401) statusCode = 500;

  // mongoose validation error — e.g. required field missing
  if (err.name === "ValidationError") {
    statusCode = 400;
    const errors = Object.values(err.errors).map((e) => e.message);
    message = errors.join(", ");
  }

  // mongoose duplicate key error — e.g. email already registered
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
  }

  // mongoose invalid ObjectId — e.g. /api/products/not-a-valid-id
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // JWT errors (in case they slip past the auth middleware)
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token has expired";
  }

  return res.status(statusCode).json({
    success: false,
    message,
    // only show the stack trace in development — never in production
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export default errorHandler;
