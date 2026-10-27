import crypto from "crypto";
import { billingService, TRUSTED_PLANS } from "../billing/razorpay";
import { trafficTracker } from "../metrics/traffic";
import { initDb, db } from "../db";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`  ok  ${msg}`);
  }
}

async function runBillingTests() {
  console.log("[Billing & Razorpay] running checks");

  await initDb();

  // 1. Trusted plans
  const plans = billingService.getPlans();
  assert(plans.length >= 3, "at least 3 trusted plans configured");
  const enterprise = billingService.getPlan("plan_enterprise_guardian");
  assert(enterprise?.amountMonthly === 2490, "enterprise plan amount is $2,490");

  // 2. Order creation
  const order = await billingService.createOrder("plan_professional", 1);
  assert(order.orderId.startsWith("order_"), "order ID starts with order_");
  assert(order.mode === "DEV_TEST_MODE" || order.mode === "RAZORPAY_TEST_MODE", "mode is valid test mode");

  // 3. Signature verification
  const paymentId = `pay_test_${Date.now()}`;
  const validSig = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "dev_secret_trustsense_bms_2026")
    .update(`${order.orderId}|${paymentId}`)
    .digest("hex");

  const isValid = billingService.verifyPaymentSignature(order.orderId, paymentId, validSig);
  assert(isValid === true, "valid HMAC-SHA256 payment signature accepted");

  const tamperedSig = validSig.replace(/^[0-9a-f]/, (c) => (c === "a" ? "b" : "a"));
  const isInvalid = billingService.verifyPaymentSignature(order.orderId, paymentId, tamperedSig);
  assert(isInvalid === false, "tampered HMAC signature rejected");

  // 4. Payment processing & entitlement grant
  const res = await billingService.processPaymentVerification(order.orderId, paymentId, validSig, 1);
  assert(res.success === true, "payment verification succeeds");
  assert(res.invoiceNumber.startsWith("INV-"), "invoice generated with INV- prefix");

  // Verify order in database
  const [dbOrder] = await db
    .select()
    .from(schema.billingOrders)
    .where(eq(schema.billingOrders.id, order.orderId))
    .limit(1);
  assert(dbOrder?.status === "PAID", "order status transitioned to PAID in database");

  // 5. Idempotent payment replay
  const replayRes = await billingService.processPaymentVerification(order.orderId, paymentId, validSig, 1);
  assert(replayRes.success === true, "idempotent payment replay succeeds without duplicate error");

  // 6. Traffic metrics tracker checks
  console.log("[Traffic Analytics] running checks");
  trafficTracker.recordRequest({
    timestamp: Date.now() - 5000,
    method: "POST",
    path: "/api/trustsense/telemetry/ingest",
    statusCode: 200,
    durationMs: 12.5,
    bytesIn: 256,
    bytesOut: 128,
  });
  trafficTracker.recordRequest({
    timestamp: Date.now() - 2000,
    method: "POST",
    path: "/api/virtual-sensor/predict",
    statusCode: 200,
    durationMs: 45.0,
    bytesIn: 512,
    bytesOut: 256,
  });

  const summary = trafficTracker.getSummary();
  assert(summary.totalRequests24h >= 2, "traffic summary includes recorded requests");
  assert(summary.avgLatencyMs > 0, "average latency is calculated from real observations");

  const breakdown = trafficTracker.getEndpointBreakdown();
  assert(breakdown.length > 0, "endpoint breakdown aggregates hits");

  if (process.exitCode) {
    console.error("Billing & Traffic checks failed.");
    process.exit(1);
  }
  console.log("All Billing & Traffic checks passed successfully.");
  process.exit(0);
}

runBillingTests().catch((err) => {
  console.error("Billing tests exception:", err);
  process.exit(1);
});
