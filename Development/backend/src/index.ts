import crypto from "crypto";
import { initDb, pool } from "./db";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRoutes from "./api/auth";
import dashboardRoutes from "./api/dashboard";
import adminRoutes from "./api/admin";
import virtualSensorRoutes from "./api/virtual-sensor";
import trustsenseRoutes from "./api/trustsense";
import vehiclesRoutes from "./api/vehicles";
import reportsRoutes from "./api/reports";
import thermalRoutes from "./api/thermal";
import onboardingRoutes from "./api/onboarding";
import { acquisitionManager } from "./acquisition/manager";
import { trafficTracker } from "./metrics/traffic";
import { billingService } from "./billing/razorpay";
import { cloudStorage } from "./cloud/storage";
import { ledgerGateway } from "./blockchain/ledger";
import { authRateLimiter, billingRateLimiter, telemetryIngestRateLimiter } from "./middleware/rateLimiter";
import jwt from "jsonwebtoken";
import { getJwtSecret, AuthenticatedUser, requireOnboardingComplete } from "./middleware/auth";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

// Request correlation ID and exposed headers middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req.headers["x-request-id"] as string) || (req.headers["request-id"] as string) || crypto.randomUUID();
  req.headers["x-request-id"] = correlationId;
  res.setHeader("X-Request-Id", correlationId);
  res.setHeader("request-id", correlationId);
  res.setHeader(
    "Permissions-Policy",
    'accelerometer=(self "https://*.razorpay.com" "https://*.sentry-cdn.com"), gyroscope=(self "https://*.razorpay.com" "https://*.sentry-cdn.com"), magnetometer=(self "https://*.razorpay.com" "https://*.sentry-cdn.com")'
  );
  (req as any).id = correlationId;
  next();
});

// CORS configuration with explicitly exposed headers
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === frontendUrl || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:") || origin === "https://api.razorpay.com") {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  exposedHeaders: [
    "X-Request-Id",
    "request-id",
    "x-rtb-fingerprint-id",
    "Retry-After",
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
    "content-length"
  ]
}));

// Retain rawBody buffer for cryptographic webhook signature verification
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(cookieParser());

// Request logger and traffic analytics
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const bytesIn = parseInt(req.headers["content-length"] || "0", 10) || 0;
  res.on("finish", () => {
    const duration = Date.now() - start;
    const bytesOut = parseInt(res.getHeader("content-length") as string || "0", 10) || 0;
    let user = (req as any).user;
    if (!user && (req.cookies?.token || req.headers?.authorization)) {
      try {
        const rawToken = req.cookies?.token || (req.headers?.authorization as string)?.replace(/^Bearer\s+/, "");
        if (rawToken) {
          user = jwt.decode(rawToken) as any;
        }
      } catch {
        // ignore decode failure for traffic tracking
      }
    }

    trafficTracker.recordRequest({
      timestamp: start,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: duration,
      bytesIn,
      bytesOut,
      tenantId: user?.tenantId,
      tenantName: user?.tenantName,
    });

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
      trustSense: "/api/trustsense",
      telemetryIngest: "/api/trustsense/telemetry/ingest",
      billingWebhook: "/api/billing/webhook",
    }
  });
});

// Health check endpoint (process liveness)
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Operational readiness probe (distinguishes process liveness from dependency readiness)
app.get("/ready", async (req: Request, res: Response) => {
  const startTime = Date.now();
  // 0. Probe billing provider health so readiness accurately reflects provider status
  try {
    await billingService.probeProviderHealth();
  } catch {
    // Probe catches internally
  }

  const checks: Record<string, any> = {
    database: { status: "unknown", latencyMs: 0 },
    inferenceService: { status: "unknown", latencyMs: 0 },
    storage: cloudStorage.getStatus(),
    ledger: await ledgerGateway.getStatus(),
    billing: billingService.getPublicConfig(),
  };

  let allReady = true;

  // 1. Database check
  try {
    const dbStart = Date.now();
    await pool.query("SELECT 1;");
    checks.database = {
      status: "connected",
      latencyMs: Date.now() - dbStart,
      database: "eculytics",
    };
  } catch (dbErr: any) {
    allReady = false;
    checks.database = {
      status: "unavailable",
      error: dbErr.message,
    };
  }

  // 2. Python inference microservice check
  const thermalEndpoint = (process.env.THERMAL_AI_URL ? process.env.THERMAL_AI_URL.replace(/\/$/, "") : "http://localhost:8000") + "/health";
  try {
    const infStart = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const infResp = await fetch(thermalEndpoint, { signal: controller.signal });
    clearTimeout(timeout);
    if (infResp.ok) {
      checks.inferenceService = {
        status: "connected",
        endpoint: thermalEndpoint,
        latencyMs: Date.now() - infStart,
      };
    } else {
      checks.inferenceService = {
        status: "degraded",
        httpStatus: infResp.status,
      };
    }
  } catch (infErr: any) {
    checks.inferenceService = {
      status: "unavailable",
      note: `Thermal AI microservice unreachable at ${thermalEndpoint}; falling back to local heuristic mode.`,
    };
  }

  const statusCode = allReady ? 200 : 503;
  res.status(statusCode).json({
    status: allReady ? "ready" : "degraded",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    checks,
  });
});

// =====================================================================
// Razorpay Standard Web Checkout Endpoints (Step 1 & Step 3)
// =====================================================================

// Step 1: POST /api/create-order
// Accepts: { amount (paise), currency, receipt, notes, planId }
// Returns: { order_id, amount, currency, key_id, providerVerified, mode }
app.post("/api/create-order", billingRateLimiter, async (req: Request, res: Response) => {
  const { amount, currency, receipt, notes, planId } = req.body;

  // Extract tenant/user if authenticated
  let tenantId = 1;
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.token;
  const token = (authHeader && authHeader.startsWith("Bearer ")) ? authHeader.slice(7) : cookieToken;
  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as AuthenticatedUser;
      if (decoded.tenantId) tenantId = decoded.tenantId;
    } catch {
      // Unauthenticated / public request
    }
  }

  // 1. Catalog plan order (trusted server-side pricing strictly enforced)
  if (planId) {
    const plan = billingService.getPlan(planId);
    if (!plan) {
      return res.status(400).json({ error: `Invalid plan ID: ${planId}` });
    }
    try {
      const order = await billingService.createStandardOrder({
        amount: Math.round(plan.amountMonthly * 100),
        currency: plan.currency,
        receipt: receipt || `rcpt_plan_${Date.now()}`,
        notes: { ...(notes || {}), planId: plan.id, planName: plan.name },
        planId: plan.id,
        tenantId,
      });
      return res.status(200).json(order);
    } catch (err: any) {
      const statusCode = err.status || (err.statusCode ? err.statusCode : 500);
      return res.status(statusCode).json({ error: err.message || "Failed to create order" });
    }
  }

  // 2. Custom amount order (strict business validation rules)
  if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) < 100) {
    return res.status(400).json({ error: "Amount must be at least 100 paise." });
  }

  if (Number(amount) > 10000000) {
    return res.status(400).json({ error: "Amount exceeds maximum allowable single transaction limit (100,000 INR)." });
  }

  try {
    const order = await billingService.createStandardOrder({
      amount: Number(amount),
      currency: currency || "INR",
      receipt,
      notes,
      tenantId,
    });
    return res.status(200).json(order);
  } catch (err: any) {
    const statusCode = err.status || (err.statusCode ? err.statusCode : 500);
    return res.status(statusCode).json({ error: err.message || "Failed to create order" });
  }
});

// Step 3: POST /api/verify-payment
// Accepts: { order_id, payment_id, signature, expected_amount, expected_currency }
// Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
app.post("/api/verify-payment", billingRateLimiter, async (req: Request, res: Response) => {
  const order_id = req.body.order_id || req.body.razorpay_order_id;
  const payment_id = req.body.payment_id || req.body.razorpay_payment_id;
  const signature = req.body.signature || req.body.razorpay_signature;

  if (!order_id || !payment_id || !signature) {
    return res.status(400).json({
      error: "Missing required fields: order_id, payment_id, and signature are required.",
    });
  }

  // Extract tenant/user if authenticated
  let tenantId: number | undefined;
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.token;
  const token = (authHeader && authHeader.startsWith("Bearer ")) ? authHeader.slice(7) : cookieToken;
  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as AuthenticatedUser;
      if (decoded.tenantId) tenantId = decoded.tenantId;
    } catch {
      // Unauthenticated
    }
  }

  try {
    const result = await billingService.verifyStandardPayment(order_id, payment_id, signature, {
      tenantId,
      expectedAmount: req.body.expected_amount ? Number(req.body.expected_amount) / 100 : undefined,
      expectedCurrency: req.body.expected_currency,
    });
    return res.status(200).json(result);
  } catch (err: any) {
    const statusCode = err.status || 400;
    return res.status(statusCode).json({ success: false, error: err.message || "Payment verification failed." });
  }
});

// Razorpay Webhook Endpoint (Verifies X-Razorpay-Signature against raw body)
app.post("/api/billing/webhook", billingRateLimiter, async (req: Request, res: Response) => {
  const signature = (req.headers["x-razorpay-signature"] as string) || "";
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);
  try {
    const result = await billingService.handleWebhook(req.body, rawBody, signature);
    res.json(result);
  } catch (err: any) {
    console.warn(`[Billing Webhook] Signature verification failed: ${err.message}`);
    res.status(400).json({ error: err.message || "Webhook verification failed" });
  }
});

// API Routes with rate limiting protection
app.use("/api/auth", authRateLimiter, authRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/dashboard", requireOnboardingComplete, dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/virtual-sensor", virtualSensorRoutes);
app.use("/api/trustsense", trustsenseRoutes);
app.use("/api/vehicles", requireOnboardingComplete, vehiclesRoutes);
app.use("/api/reports", requireOnboardingComplete, reportsRoutes);
app.use("/api/thermal", requireOnboardingComplete, thermalRoutes);

// Resilient alias routes for clients configured with /api in NEXT_PUBLIC_API_URL
app.use("/api/api/trustsense", trustsenseRoutes);
app.use("/api/api/virtual-sensor", virtualSensorRoutes);

// 404 Route Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    status: 404
  });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).id || req.headers["x-request-id"];
  console.error(`[${requestId}] Unhandled server error:`, err);
  const isProd = process.env.NODE_ENV === "production";
  res.status(err.status || 500).json({
    error: isProd ? "Internal server error" : (err.message || "Internal server error"),
    requestId,
    status: err.status || 500
  });
});


const server = app.listen(port, async () => {
  await initDb();
  await acquisitionManager.start();
  console.log(`=======================================================`);
  console.log(`  ECUlytics & TrustSense-BMS API Gateway`);
  console.log(`  Listening at: http://localhost:${port}`);
  console.log(`  Frontend allowed origin: ${frontendUrl}`);
  console.log(`  Telemetry ingest: http://localhost:${port}/api/trustsense/telemetry/ingest`);
  console.log(`=======================================================`);
});

// Graceful shutdown handling for container orchestrators and process supervisors (SIGTERM, SIGINT)
const handleShutdown = async (signal: string) => {
  console.log(`[Server] Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log("[Server] HTTP server stopped accepting new connections.");
    try {
      await acquisitionManager.stop();
      console.log("[Acquisition] Data acquisition manager stopped.");
    } catch (e: any) {
      console.warn("[Acquisition] Error stopping acquisition manager:", e.message);
    }
    try {
      await pool.end();
      console.log("[PostgreSQL] Database connection pool drained.");
    } catch (e: any) {
      console.warn("[PostgreSQL] Error draining database connection pool:", e.message);
    }
    process.exit(0);
  });

  // Force exit after 10s timeout
  setTimeout(() => {
    console.error("[Server] Graceful shutdown timeout exceeded. Forcing process exit.");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

