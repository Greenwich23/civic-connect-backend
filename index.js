import "./src/config/loadEnv.js";
import connectDB from "./src/config/db.js";
import app from "./src/app.js";

const startServer = async () => {
  console.log("Starting server...");
  try {
    console.log("MONGO_URI:", process.env.MONGO_URI);
    await connectDB();
    console.log("Database connected successfully");

    const PORT = process.env.PORT || 6000;
    console.log(`Attempting to start server on port ${PORT}`);

    const server = app.listen(PORT, () => {
      console.log(`✅ Server successfully running on port ${PORT}`);
      console.log(`📍 Test it at: http://localhost:${PORT}`);
    });

    server.on("error", (error) => {
      console.error("❌ Server error:", error);
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use`);
      }
    });
  } catch (error) {
    console.error("❌ Error starting server:", error);
    console.error("Stack trace:", error.stack);
  }
};

startServer();
