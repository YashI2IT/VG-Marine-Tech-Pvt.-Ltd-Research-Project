import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Access-Control-Expose-Headers",
            value:
              "X-Request-Id, request-id, x-rtb-fingerprint-id, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset",
          },
          {
            key: "Permissions-Policy",
            value:
              'accelerometer=(self "https://*.razorpay.com" "https://*.sentry-cdn.com"), gyroscope=(self "https://*.razorpay.com" "https://*.sentry-cdn.com"), magnetometer=(self "https://*.razorpay.com" "https://*.sentry-cdn.com")',
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://api.razorpay.com https://*.sentry-cdn.com",
              "connect-src 'self' https: wss: http://localhost:* http://127.0.0.1:* https://api.razorpay.com https://lumberjack.razorpay.com https://*.sentry.io",
              "img-src 'self' https: data: blob:",
              "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
              "style-src 'self' 'unsafe-inline' https:",
              "font-src 'self' https: data:",
            ].join("; "),
          },
        ],
      },
    ];
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
