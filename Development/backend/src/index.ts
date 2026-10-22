import { initDb } from "./db";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRoutes from "./api/auth";
import dashboardRoutes from "./api/dashboard";
import adminRoutes from "./api/admin";
import virtualSensorRoutes from "./api/virtual-sensor";
import trustsenseRoutes from "./api/trustsense";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

// CORS configuration
app.use(cors({
  origin: frontendUrl,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Request logger
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.originalUrl !== "/health") {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Root information endpoint
app.get("/", (req: Request, res: Response) => {
  res.json({
    platform: "ECUlytics & TrustSense-BMS API Gateway",
    version: "1.0.0",
    status: "operational",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/health",
      auth: "/api/auth",
      dashboard: "/api/dashboard",
      admin: "/api/admin",
      virtualSensor: "/api/virtual-sensor",
      trustSense: "/api/trustsense"
    }
  });
});

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/virtual-sensor", virtualSensorRoutes);
app.use("/api/trustsense", trustsenseRoutes);

// 404 Route Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    status: 404
  });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled server error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    status: err.status || 500
  });
});

app.listen(port, async () => {
  await initDb();
  console.log(`=======================================================`);
  console.log(`  ECUlytics & TrustSense-BMS API Gateway`);
  console.log(`  Listening at: http://localhost:${port}`);
  console.log(`  Frontend allowed origin: ${frontendUrl}`);
  console.log(`=======================================================`);
});
