import express from "express";
import cors from "cors";
import morgan from "morgan";
import errorHandler from "./middleware/errorHandler.js";
import userRoutes from "./routes/user/index.js";
import adminRoutes from "./routes/admin/index.js";

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Origins must match the browser's Origin header exactly: no trailing slash.
const allowedOrigins = [
  process.env.CUSTOMER_URL,
  // process.env.ADMIN_URL,
  "http://localhost:5173",
  "https://civcpulse.netlify.app",
]
  .filter(Boolean)
  .map((origin) => origin.replace(/\/$/, ""));

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ─── BODY PARSERS ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── REQUEST LOGGER (dev only) ────────────────────────────────────────────────
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ success: true, message: "Civic pulse API is running" });
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use("/api/admin", adminRoutes);
app.use("/api", userRoutes);

// ─── 404 HANDLER ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ─── GLOBAL ERROR HANDLER ────────────────────────────────────────────────────
// must be last — after all routes
app.use(errorHandler);

export default app;
