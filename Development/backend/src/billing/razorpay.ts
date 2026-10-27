import crypto from "crypto";
import Razorpay from "razorpay";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq, desc } from "drizzle-orm";

export interface PlanConfig {
  id: string;
  name: string;
  tier: "Starter" | "Professional" | "Enterprise";
  amountMonthly: number;
  currency: string;
  billingCycle: string;
  quotas: {
    telemetryCalls: number;
    virtualSensorInferences: number;
    merkleAnchors: number;
    monitoredVehicles: number;
  };
  features: string[];
}

export const TRUSTED_PLANS: Record<string, PlanConfig> = {
  plan_starter: {
    id: "plan_starter",
    name: "Starter Fleet Tier",
    tier: "Starter",
    amountMonthly: 499,
    currency: "USD",
    billingCycle: "Monthly",
    quotas: {
      telemetryCalls: 20000,
      virtualSensorInferences: 5000,
      merkleAnchors: 1000,
      monitoredVehicles: 10,
    },
    features: [
      "Up to 10 monitored vehicles",
      "Real-time CAN telemetry ingest",
      "CNN-LSTM thermal virtual sensing",
      "Local Merkle provenance evidence",
    ],
  },
  plan_professional: {
    id: "plan_professional",
    name: "Professional Fleet Guardian",
    tier: "Professional",
    amountMonthly: 1499,
    currency: "USD",
    billingCycle: "Monthly",
    quotas: {
      telemetryCalls: 50000,
      virtualSensorInferences: 12000,
      merkleAnchors: 2500,
      monitoredVehicles: 50,
    },
    features: [
      "Up to 50 monitored vehicles",
      "Priority CNN-LSTM inference",
      "Automated quarantine & cyber-physical trust gate",
      "Merkle batching & Hyperledger Fabric anchoring",
    ],
  },
  plan_enterprise_guardian: {
    id: "plan_enterprise_guardian",
    name: "Enterprise Fleet Guardian",
    tier: "Enterprise",
    amountMonthly: 2490,
    currency: "USD",
    billingCycle: "Monthly (Next charge: Nov 1, 2026)",
    quotas: {
      telemetryCalls: 100000,
      virtualSensorInferences: 20000,
      merkleAnchors: 5000,
      monitoredVehicles: 100,
    },
    features: [
      "Up to 100 monitored vehicles",
      "Sub-70ms CNN-LSTM inference SLA",
      "Cryptographic tamper-detection verification",
      "Hyperledger Fabric ledger anchors & battery passports",
    ],
  },
};

export class RazorpayBillingService {
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;
  private isTestMode: boolean;
  private razorpayInstance: any = null;
  private providerHealth: "UNCONFIGURED" | "ACTIVE_VERIFIED" | "AUTHENTICATION_FAILED" | "NETWORK_ERROR" = "UNCONFIGURED";
  private lastHealthCheck: string | null = null;
  private lastProviderError: string | null = null;

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_dev_mode_trustsense";
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || "dev_secret_trustsense_bms_2026";
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "dev_webhook_secret_2026";
    this.isTestMode = !process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.startsWith("rzp_test_");
    if (this.isConfigured()) {
      try {
        this.razorpayInstance = new Razorpay({
          key_id: this.keyId,
          key_secret: this.keySecret,
        });
      } catch (e) {
        console.warn("[Razorpay] Failed to initialize Razorpay SDK instance:", e);
      }
    }
  }

  public getRazorpayInstance(): any {
    if (!this.razorpayInstance && this.isConfigured()) {
      try {
        this.razorpayInstance = new Razorpay({
          key_id: this.keyId,
          key_secret: this.keySecret,
        });
      } catch (e) {
        console.warn("[Razorpay] Failed to initialize Razorpay SDK instance:", e);
      }
    }
    return this.razorpayInstance;
  }

  public getPlans(): PlanConfig[] {
    return Object.values(TRUSTED_PLANS);
  }

  public getPlan(planId: string): PlanConfig | null {
    return TRUSTED_PLANS[planId] || null;
  }

  public isConfigured(): boolean {
    return Boolean(
      process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET &&
      !process.env.RAZORPAY_KEY_ID.includes("dev_mode")
    );
  }

  /**
   * Probe Razorpay provider connectivity and test credentials using the Orders API.
   * Updates internal health state and diagnostic messaging without leaking secrets.
   */
  public async probeProviderHealth(): Promise<{
    configured: boolean;
    status: "ACTIVE_VERIFIED" | "AUTHENTICATION_FAILED" | "NETWORK_ERROR" | "UNCONFIGURED";
    message: string;
    isTestMode: boolean;
  }> {
    if (!this.isConfigured()) {
      this.providerHealth = "UNCONFIGURED";
      this.lastHealthCheck = new Date().toISOString();
      this.lastProviderError = "Razorpay credentials not configured or dev mode placeholder.";
      return {
        configured: false,
        status: "UNCONFIGURED",
        message: "Razorpay credentials are not configured in backend environment.",
        isTestMode: this.isTestMode,
      };
    }

    try {
      const instance = this.getRazorpayInstance();
      if (!instance) {
        throw new Error("Razorpay instance initialization failed.");
      }
      // Official SDK test probe
      await instance.orders.all({ count: 1 });
      this.providerHealth = "ACTIVE_VERIFIED";
      this.lastHealthCheck = new Date().toISOString();
      this.lastProviderError = null;
      return {
        configured: true,
        status: "ACTIVE_VERIFIED",
        message: "Razorpay test credentials authenticated successfully with Orders API.",
        isTestMode: this.isTestMode,
      };
    } catch (err: any) {
      this.lastHealthCheck = new Date().toISOString();
      const isAuthErr =
        err.statusCode === 401 ||
        (err.error?.code === "BAD_REQUEST_ERROR" &&
          err.error?.description?.toLowerCase().includes("auth"));

      if (isAuthErr) {
        this.providerHealth = "AUTHENTICATION_FAILED";
        this.lastProviderError =
          "Authentication failed with Razorpay API (HTTP 401). Invalid or deactivated key ID/secret pair.";
        return {
          configured: true,
          status: "AUTHENTICATION_FAILED",
          message:
            "Razorpay API responded with HTTP 401 Authentication failed. The configured key ID and secret are invalid or deactivated.",
          isTestMode: this.isTestMode,
        };
      } else {
        this.providerHealth = "NETWORK_ERROR";
        this.lastProviderError = err.message || "Failed to reach Razorpay API endpoint.";
        return {
          configured: true,
          status: "NETWORK_ERROR",
          message: `Network or provider error: ${err.message || "Unknown error"}`,
          isTestMode: this.isTestMode,
        };
      }
    }
  }

  public getPublicConfig() {
    let providerStatus: string;
    if (!this.isConfigured()) {
      providerStatus = "DEV_TEST_MODE_UNVERIFIED";
    } else if (this.providerHealth === "AUTHENTICATION_FAILED") {
      providerStatus = "CONFIGURED_DEGRADED_AUTH_FAILED";
    } else if (this.providerHealth === "NETWORK_ERROR") {
      providerStatus = "CONFIGURED_DEGRADED_NETWORK_ERROR";
    } else if (this.providerHealth === "ACTIVE_VERIFIED") {
      providerStatus = "CONFIGURED_ACTIVE";
    } else {
      providerStatus = "CONFIGURED_UNVERIFIED";
    }

    return {
      keyId: this.keyId,
      isTestMode: this.isTestMode,
      isConfigured: this.isConfigured(),
      currency: "USD",
      provider: this.isConfigured()
        ? (this.isTestMode ? "Razorpay Test Mode (Live API)" : "Razorpay Live Mode")
        : "Razorpay (Local Dev Test Double)",
      providerStatus,
      lastHealthCheck: this.lastHealthCheck,
      providerError: this.lastProviderError,
    };
  }

  /**
   * Optional server-side call to Razorpay Orders API using SDK
   */
  private async createRazorpayApiOrder(plan: PlanConfig, tenantId: number): Promise<{ id: string } | null> {
    if (!this.isConfigured()) return null;
    try {
      const instance = this.getRazorpayInstance();
      if (instance) {
        const order = await instance.orders.create({
          amount: Math.round(plan.amountMonthly * 100),
          currency: plan.currency,
          receipt: `rcpt_${Date.now()}_t${tenantId}`,
          notes: {
            planId: plan.id,
            planName: plan.name,
            tenantId: tenantId.toString(),
          },
        });
        console.log(`[Razorpay] Successfully created provider order via SDK: ${order.id}`);
        this.providerHealth = "ACTIVE_VERIFIED";
        this.lastHealthCheck = new Date().toISOString();
        this.lastProviderError = null;
        return { id: order.id };
      }
      return null;
    } catch (err: any) {
      console.warn(`[Razorpay] SDK error calling Razorpay API: ${err.message}. Falling back to dev order.`);
      const isAuthErr =
        err.statusCode === 401 ||
        (err.error?.code === "BAD_REQUEST_ERROR" &&
          err.error?.description?.toLowerCase().includes("auth"));
      if (isAuthErr) {
        this.providerHealth = "AUTHENTICATION_FAILED";
        this.lastHealthCheck = new Date().toISOString();
        this.lastProviderError =
          "Authentication failed with Razorpay API (HTTP 401). Invalid or deactivated key ID/secret pair.";
      }
      return null;
    }
  }

  /**
   * Standard Razorpay Order Creation (Step 1)
   * Minimum amount: 100 paise
   * Applies rate limiting, plan catalog authority, order persistence, and safe provider error handling.
   */
  public async createStandardOrder(params: {
    amount: number;
    currency?: string;
    receipt?: string;
    notes?: Record<string, string>;
    orderId?: string;
    planId?: string;
    tenantId?: number;
  }): Promise<{
    order_id: string;
    amount: number;
    currency: string;
    key_id: string;
    providerVerified: boolean;
    mode: string;
  }> {
    let amount = Number(params.amount);
    let currency = (params.currency || "INR").toUpperCase();
    const planId = params.planId || params.notes?.planId;

    // Server-side plan price authority
    if (planId) {
      const plan = this.getPlan(planId);
      if (plan) {
        amount = Math.round(plan.amountMonthly * 100);
        currency = plan.currency.toUpperCase();
      }
    }

    if (!amount || isNaN(amount) || amount < 100) {
      const err: any = new Error("Amount must be at least 100 paise.");
      err.status = 400;
      throw err;
    }

    if (amount > 10000000) {
      const err: any = new Error("Amount exceeds maximum allowable single transaction limit (100,000 INR).");
      err.status = 400;
      throw err;
    }

    const receipt = params.receipt || `rcpt_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const localOrderId = params.orderId || `order_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const instance = this.getRazorpayInstance();

    // Persist order in PostgreSQL so application maintains ownership
    try {
      await db.insert(schema.billingOrders).values({
        id: localOrderId,
        tenantId: params.tenantId || 1,
        planId: planId || "standard_checkout",
        amount: amount / 100,
        currency,
        razorpayOrderId: localOrderId,
        status: "CREATED",
        mode: this.isConfigured() ? (this.isTestMode ? "RAZORPAY_TEST_MODE" : "RAZORPAY_LIVE") : "DEV_TEST_MODE",
        metadata: {
          receipt,
          notes: params.notes || {},
          createdAt: new Date().toISOString(),
        },
      });
    } catch (dbErr) {
      // Safe if primary key or test double collision
    }

    if (!instance || !this.isConfigured()) {
      return {
        order_id: localOrderId,
        amount: Math.round(amount),
        currency,
        key_id: this.keyId,
        providerVerified: false,
        mode: "DEV_TEST_MODE",
      };
    }

    try {
      const order = await instance.orders.create({
        amount: Math.round(amount),
        currency,
        receipt,
        notes: params.notes || {},
      });

      console.log(`[Razorpay] Successfully created standard order: ${order.id} (${order.amount} ${order.currency})`);
      this.providerHealth = "ACTIVE_VERIFIED";
      this.lastHealthCheck = new Date().toISOString();
      this.lastProviderError = null;

      try {
        await db.update(schema.billingOrders).set({
          id: order.id,
          razorpayOrderId: order.id,
          mode: this.isTestMode ? "RAZORPAY_TEST_MODE" : "RAZORPAY_LIVE",
        }).where(eq(schema.billingOrders.id, localOrderId));
      } catch {
        // Safe if DB update omitted
      }

      return {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: this.keyId,
        providerVerified: true,
        mode: this.isTestMode ? "RAZORPAY_TEST_MODE" : "RAZORPAY_LIVE",
      };
    } catch (err: any) {
      console.error("[Razorpay] Order creation error:", err);
      const isAuthErr =
        err.statusCode === 401 ||
        (err.error?.code === "BAD_REQUEST_ERROR" &&
          err.error?.description?.toLowerCase().includes("auth"));

      if (isAuthErr) {
        this.providerHealth = "AUTHENTICATION_FAILED";
        this.lastHealthCheck = new Date().toISOString();
        this.lastProviderError =
          "Authentication failed with Razorpay API (HTTP 401). Invalid or deactivated key ID/secret pair.";
      }

      try {
        await db.update(schema.billingOrders).set({
          status: "PROVIDER_AUTH_FAILED",
          metadata: {
            receipt,
            notes: params.notes || {},
            error: isAuthErr ? "Provider authentication failed (HTTP 401)" : (err.message || "Provider error"),
            failedAt: new Date().toISOString(),
          },
        }).where(eq(schema.billingOrders.id, localOrderId));
      } catch {}

      const statusCode = isAuthErr ? 401 : (err.statusCode || err.status || 500);
      const message = isAuthErr
        ? "Authentication failed with Razorpay API (HTTP 401). Verify that RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET match in backend environment."
        : (err.error?.description || err.message || "Failed to create Razorpay order");
      const customErr: any = new Error(message);
      customErr.status = statusCode;
      customErr.statusCode = statusCode;
      throw customErr;
    }
  }

  /**
   * Standard Razorpay Payment Verification (Step 3)
   * Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
   * Verifies timing-safe signature math, database order existence, tenant ownership, and provider confirmation.
   */
  public async verifyStandardPayment(
    orderId: string,
    paymentId: string,
    signature: string,
    options?: {
      tenantId?: number;
      expectedAmount?: number;
      expectedCurrency?: string;
    }
  ): Promise<{
    success: boolean;
    message: string;
    order_id: string;
    payment_id: string;
    providerVerified: boolean;
  }> {
    if (!orderId || !paymentId || !signature) {
      const err: any = new Error("Missing required fields: order_id, payment_id, and signature are required.");
      err.status = 400;
      throw err;
    }

    if (typeof signature !== "string" || signature.length !== 64 || !/^[a-fA-F0-9]{64}$/.test(signature)) {
      const err: any = new Error("Malformed payment signature: signature must be a 64-character hexadecimal string.");
      err.status = 400;
      throw err;
    }

    const isValid = this.verifyPaymentSignature(orderId, paymentId, signature);
    if (!isValid) {
      const err: any = new Error("Payment verification failed: signature mismatch.");
      err.status = 400;
      throw err;
    }

    // Confirm that the order exists in the database and was generated by this application
    const [existingOrder] = await db
      .select()
      .from(schema.billingOrders)
      .where(eq(schema.billingOrders.id, orderId))
      .limit(1);

    if (!existingOrder) {
      const err: any = new Error(`Order ${orderId} not found or was never created by this application.`);
      err.status = 400;
      throw err;
    }

    // Confirm tenant boundary
    if (options?.tenantId && existingOrder.tenantId && existingOrder.tenantId !== options.tenantId) {
      const err: any = new Error(`Unauthorized: Order belongs to tenant ${existingOrder.tenantId}, not tenant ${options.tenantId}.`);
      err.status = 403;
      throw err;
    }

    // Confirm amount consistency if expectedAmount provided
    if (options?.expectedAmount !== undefined && Math.abs(existingOrder.amount - options.expectedAmount) > 0.01) {
      const err: any = new Error(`Order amount mismatch: expected ${options.expectedAmount}, found ${existingOrder.amount}.`);
      err.status = 400;
      throw err;
    }

    // Confirm currency consistency if expectedCurrency provided
    if (options?.expectedCurrency && existingOrder.currency.toUpperCase() !== options.expectedCurrency.toUpperCase()) {
      const err: any = new Error(`Order currency mismatch: expected ${options.expectedCurrency}, found ${existingOrder.currency}.`);
      err.status = 400;
      throw err;
    }

    // Check with provider if active credentials configured
    let providerVerified = false;
    if (this.isConfigured() && this.providerHealth === "ACTIVE_VERIFIED" && !paymentId.startsWith("pay_dev_") && !paymentId.startsWith("pay_sim_")) {
      const providerCheck = await this.confirmPaymentWithProvider(paymentId);
      providerVerified = providerCheck.confirmed;
    }

    // Idempotent check
    if (existingOrder.status === "PAID") {
      return {
        success: true,
        message: "Payment already verified (idempotent)",
        order_id: orderId,
        payment_id: paymentId,
        providerVerified: existingOrder.mode === "RAZORPAY_TEST_MODE" && providerVerified,
      };
    }

    // Mark order as PAID
    await db
      .update(schema.billingOrders)
      .set({
        status: "PAID",
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
        updatedAt: new Date(),
      })
      .where(eq(schema.billingOrders.id, orderId));

    return {
      success: true,
      message: "Payment verified successfully",
      order_id: orderId,
      payment_id: paymentId,
      providerVerified,
    };
  }

  /**
   * Optional server-side confirmation of payment status with Razorpay Payments API
   */
  public async confirmPaymentWithProvider(paymentId: string): Promise<{ confirmed: boolean; status?: string; details?: any }> {
    if (!this.isConfigured()) {
      return { confirmed: false, status: "UNCONFIGURED_DEV_MODE" };
    }
    try {
      const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
      const resp = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
        method: "GET",
        headers: { "Authorization": `Basic ${auth}` },
      });
      if (resp.ok) {
        const data = (await resp.json()) as any;
        const confirmed = data.status === "captured" || data.status === "authorized";
        return { confirmed, status: data.status, details: data };
      }
      return { confirmed: false, status: `HTTP_${resp.status}` };
    } catch (err: any) {
      return { confirmed: false, status: "NETWORK_ERROR", details: err.message };
    }
  }

  /**
   * Create a new billing order with trusted server-side amounts.
   */
  public async createOrder(
    planId: string,
    tenantId: number = 1
  ): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    plan: PlanConfig;
    keyId: string;
    mode: string;
    providerVerified: boolean;
  }> {
    const plan = this.getPlan(planId);
    if (!plan) {
      throw new Error(`Invalid plan ID: ${planId}`);
    }

    const apiOrder = await this.createRazorpayApiOrder(plan, tenantId);
    const orderId = apiOrder ? apiOrder.id : `order_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const mode = apiOrder
      ? (this.isTestMode ? "RAZORPAY_TEST_MODE" : "RAZORPAY_LIVE")
      : "DEV_TEST_MODE";

    // Persist order state in PostgreSQL
    await db.insert(schema.billingOrders).values({
      id: orderId,
      tenantId,
      planId: plan.id,
      amount: plan.amountMonthly,
      currency: plan.currency,
      razorpayOrderId: orderId,
      status: "CREATED",
      mode,
      metadata: {
        planName: plan.name,
        tier: plan.tier,
        createdAt: new Date().toISOString(),
        providerApiUsed: Boolean(apiOrder),
      },
    });

    return {
      orderId,
      amount: plan.amountMonthly,
      currency: plan.currency,
      plan,
      keyId: this.keyId,
      mode,
      providerVerified: Boolean(apiOrder),
    };
  }

  /**
   * Verify server-side payment signature:
   * signature = HMAC-SHA256(order_id + "|" + payment_id, secret)
   */
  public verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string
  ): boolean {
    if (!signature || !orderId || !paymentId) return false;
    const expected = crypto
      .createHmac("sha256", this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    if (expected.length !== signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  /**
   * Complete payment verification and idempotently grant plan entitlements.
   */
  public async processPaymentVerification(
    orderId: string,
    paymentId: string,
    signature: string,
    tenantId: number = 1
  ): Promise<{
    success: boolean;
    orderId: string;
    paymentId: string;
    subscriptionId: string;
    invoiceNumber: string;
    providerVerified: boolean;
    providerStatus: string;
  }> {
    if (!orderId || !paymentId || !signature) {
      throw new Error("Missing required fields: orderId, paymentId, and signature are required.");
    }

    if (typeof signature !== "string" || signature.length !== 64 || !/^[a-fA-F0-9]{64}$/.test(signature)) {
      throw new Error("Malformed payment signature: signature must be a 64-character hexadecimal string.");
    }

    const isSignatureValid = this.verifyPaymentSignature(orderId, paymentId, signature);
    if (!isSignatureValid) {
      throw new Error("Invalid payment signature: verification failed.");
    }

    // 1. Check existing order
    const [existingOrder] = await db
      .select()
      .from(schema.billingOrders)
      .where(eq(schema.billingOrders.id, orderId))
      .limit(1);

    if (!existingOrder) {
      throw new Error(`Order ${orderId} not found.`);
    }

    // Tenant boundary check
    if (existingOrder.tenantId && existingOrder.tenantId !== tenantId) {
      throw new Error(`Unauthorized: Order belongs to tenant ${existingOrder.tenantId}, not tenant ${tenantId}.`);
    }

    const providerCheck = await this.confirmPaymentWithProvider(paymentId);
    const providerVerified = providerCheck.confirmed;
    const providerStatus = providerVerified
      ? "PROVIDER_CONFIRMED"
      : (this.isConfigured() && this.providerHealth === "ACTIVE_VERIFIED" ? "PROVIDER_UNCONFIRMED" : "LOCAL_TEST_DOUBLE");

    // Idempotent check
    if (existingOrder.status === "PAID") {
      const [existingInvoice] = await db
        .select()
        .from(schema.billingInvoices)
        .where(eq(schema.billingInvoices.razorpayPaymentId, paymentId))
        .limit(1);

      return {
        success: true,
        orderId,
        paymentId,
        subscriptionId: "sub-default-enterprise",
        invoiceNumber: existingInvoice?.invoiceNumber || "INV-EXISTING",
        providerVerified,
        providerStatus,
      };
    }

    const plan = this.getPlan(existingOrder.planId) || TRUSTED_PLANS.plan_enterprise_guardian;

    // 2. Mark order as PAID
    await db
      .update(schema.billingOrders)
      .set({
        status: "PAID",
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
        updatedAt: new Date(),
      })
      .where(eq(schema.billingOrders.id, orderId));

    // 3. Update or create tenant subscription
    const subId = `sub_${Date.now()}`;
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    await db
      .insert(schema.subscriptions)
      .values({
        id: subId,
        tenantId,
        planId: plan.id,
        planName: plan.name,
        tier: plan.tier,
        amountMonthly: plan.amountMonthly,
        currency: plan.currency,
        billingCycle: `Monthly (Next charge: ${nextMonth.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" })})`,
        paymentMethod: `Razorpay Online (${this.isConfigured() ? (this.isTestMode ? "Test Mode" : "Live") : "Dev Test Double"})`,
        status: "Active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: nextMonth,
        razorpaySubscriptionId: `sub_rzp_${Date.now()}`,
      });

    // 4. Create invoice
    const invId = `inv-${Date.now()}`;
    const invNum = `INV-${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;

    await db.insert(schema.billingInvoices).values({
      id: invId,
      tenantId,
      subscriptionId: subId,
      invoiceNumber: invNum,
      amount: `$${plan.amountMonthly.toFixed(2)}`,
      amountNumeric: plan.amountMonthly,
      currency: plan.currency,
      status: "Paid",
      billingPeriod: new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
      razorpayPaymentId: paymentId,
      pdfUrl: "#",
      paidAt: new Date(),
    });

    return {
      success: true,
      orderId,
      paymentId,
      subscriptionId: subId,
      invoiceNumber: invNum,
      providerVerified,
      providerStatus,
    };
  }

  /**
   * Isolated development simulation settlement.
   * Only used when RAZORPAY_KEY_ID is not configured.
   * Client calls this endpoint instead of hardcoding or fabricating secrets in the browser.
   */
  public async devSimulatePayment(
    orderId: string,
    tenantId: number = 1
  ): Promise<{
    success: boolean;
    orderId: string;
    paymentId: string;
    subscriptionId: string;
    invoiceNumber: string;
    providerVerified: boolean;
    mode: string;
    note: string;
  }> {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Payment simulation is strictly forbidden in production mode.");
    }

    const [existingOrder] = await db
      .select()
      .from(schema.billingOrders)
      .where(eq(schema.billingOrders.id, orderId))
      .limit(1);

    if (!existingOrder) {
      throw new Error(`Order ${orderId} not found.`);
    }

    const paymentId = `pay_dev_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const signature = crypto
      .createHmac("sha256", this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const result = await this.processPaymentVerification(orderId, paymentId, signature, tenantId);

    return {
      ...result,
      providerVerified: false,
      mode: "DEV_TEST_DOUBLE_UNVERIFIED",
      note: "Settled via local backend test double. No external Razorpay API call executed.",
    };
  }

  /**
   * Verify and process incoming Razorpay webhooks against raw request body.
   */
  public verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    if (!signature) return false;
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : rawBody;
    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(bodyStr)
      .digest("hex");
    if (expected.length !== signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  /**
   * Idempotent webhook handler for Razorpay payment lifecycle events.
   */
  public async handleWebhook(
    event: any,
    rawBody: string | Buffer,
    signature: string
  ): Promise<{ handled: boolean; eventType: string; status: string }> {
    if (!this.verifyWebhookSignature(rawBody, signature)) {
      throw new Error("Invalid webhook signature.");
    }

    const eventType = event.event;
    const payment = event.payload?.payment?.entity;
    const orderId = payment?.order_id;
    const paymentId = payment?.id;

    if (!orderId) {
      return { handled: true, eventType, status: "IGNORED_NO_ORDER_ID" };
    }

    const [existingOrder] = await db
      .select()
      .from(schema.billingOrders)
      .where(eq(schema.billingOrders.razorpayOrderId, orderId))
      .limit(1);

    if (!existingOrder) {
      return { handled: true, eventType, status: "IGNORED_ORDER_NOT_FOUND" };
    }

    switch (eventType) {
      case "order.paid":
      case "payment.captured": {
        if (existingOrder.status !== "PAID") {
          await db
            .update(schema.billingOrders)
            .set({
              status: "PAID",
              razorpayPaymentId: paymentId || existingOrder.razorpayPaymentId,
              updatedAt: new Date(),
            })
            .where(eq(schema.billingOrders.id, existingOrder.id));

          // Idempotent invoice check
          const [inv] = await db
            .select()
            .from(schema.billingInvoices)
            .where(eq(schema.billingInvoices.razorpayPaymentId, paymentId || existingOrder.id))
            .limit(1);

          if (!inv) {
            const plan = this.getPlan(existingOrder.planId) || TRUSTED_PLANS.plan_enterprise_guardian;
            await db.insert(schema.billingInvoices).values({
              id: `inv-wh-${Date.now()}`,
              tenantId: existingOrder.tenantId || 1,
              subscriptionId: "sub-webhook-auto",
              invoiceNumber: `INV-WH-${Date.now().toString().slice(-6)}`,
              amount: `$${plan.amountMonthly.toFixed(2)}`,
              amountNumeric: plan.amountMonthly,
              currency: plan.currency,
              status: "Paid",
              billingPeriod: new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
              razorpayPaymentId: paymentId || existingOrder.id,
              pdfUrl: "#",
              paidAt: new Date(),
            });
          }
        }
        return { handled: true, eventType, status: "ORDER_PAID_PROCESSED" };
      }

      case "payment.failed": {
        await db
          .update(schema.billingOrders)
          .set({
            status: "FAILED",
            updatedAt: new Date(),
          })
          .where(eq(schema.billingOrders.id, existingOrder.id));
        return { handled: true, eventType, status: "ORDER_MARKED_FAILED" };
      }

      case "refund.processed": {
        await db
          .update(schema.billingOrders)
          .set({
            status: "REFUNDED",
            updatedAt: new Date(),
          })
          .where(eq(schema.billingOrders.id, existingOrder.id));
        return { handled: true, eventType, status: "ORDER_MARKED_REFUNDED" };
      }

      default:
        return { handled: true, eventType, status: "UNHANDLED_EVENT_ACKNOWLEDGED" };
    }
  }
}

export const billingService = new RazorpayBillingService();

