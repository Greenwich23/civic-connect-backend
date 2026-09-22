// this must be registered LAST in app.js — after all routes
// Express recognises it as an error handler because it has 4 parameters (err, req, res, next)

const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl} — ${err.message}`);
  console.error(err.stack);

  let statusCode = err.statusCode || 500;
  let message = err.message || "Something went wrong on the server";

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
