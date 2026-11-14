import "dotenv/config";

import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { redisClient } from "./config/redis.js";
import { pool } from "./config/database.js";
import { authMiddleware } from "./middleware/auth.middleware.js";

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// Security & Parsing Middlewares
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  })
);
app.use(cookieParser());
app.use(express.json());

// Main API route
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "DataScope API is running!",
  });
});

// Redis health-check route
app.get("/health/redis", async (req: Request, res: Response) => {
  try {
    const result = await redisClient.ping();

    res.status(200).json({
      success: true,
      message: "Redis connection successful!",
      redis: result,
    });
  } catch (error) {
    console.error("Redis connection failed:", error);

    res.status(500).json({
      success: false,
      message: "Redis connection failed!",
    });
  }
});

// PostgreSQL health-check route
app.get("/health/database", async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT NOW() AS current_time");

    res.status(200).json({
      success: true,
      message: "PostgreSQL connection successful!",
      databaseTime: result.rows[0].current_time,
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    res.status(500).json({
      success: false,
      message: "PostgreSQL connection failed!",
    });
  }
});

// Protected test endpoint for authenticated user session and role
app.get("/api/v1/auth/me", authMiddleware, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Authenticated user session retrieved successfully",
    user: req.user,
    session: req.session,
  });
});

// Start server after database and Redis connect
async function startServer() {
  try {
    await redisClient.connect();
    console.log("Redis connected successfully!");

    await pool.query("SELECT 1");
    console.log("PostgreSQL connected successfully!");

    app.listen(PORT, () => {
      console.log(`DataScope server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
