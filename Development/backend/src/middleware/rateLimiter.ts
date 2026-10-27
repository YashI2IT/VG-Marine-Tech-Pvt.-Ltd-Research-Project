import { Request, Response, NextFunction } from "express";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

/**
 * In-memory sliding-window rate limiter for sensitive endpoints.
 * Protects against brute-force attacks on auth, billing, and ingestion.
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  const { windowMs, maxRequests, message = "Too many requests. Please try again later." } = options;
  const store = new Map<string, RateLimitRecord>();

  // Periodically cleanup expired entries
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetAt) {
        store.delete(key);
      }
    }
  }, Math.max(10000, windowMs));

  return (req: Request, res: Response, next: NextFunction) => {
    // Determine client identifier (IP or X-Forwarded-For)
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    const key = `${req.baseUrl || req.path}:${ip.split(",")[0].trim()}`;
    const now = Date.now();

    const record = store.get(key);

    if (!record || now > record.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", maxRequests - 1);
      return next();
    }

    if (record.count >= maxRequests) {
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader("Retry-After", retryAfterSec);
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", 0);
      return res.status(429).json({
        error: message,
        retryAfterSec,
      });
    }

    record.count++;
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - record.count));
    next();
  };
}

// Preset rate limiters for specific tiers
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: "Too many authentication attempts. Please wait 1 minute.",
});

export const billingRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: "Too many billing operations. Please wait a moment.",
});

export const telemetryIngestRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 1200, // Up to 20Hz continuous ingest per gateway IP
  message: "Telemetry ingestion rate limit exceeded.",
});
