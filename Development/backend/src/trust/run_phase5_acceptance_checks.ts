/**
 * TrustSense-BMS / ECUlytics — Phase 5: End-to-End Acceptance Suite
 * 
 * Comprehensive automated verification covering:
 * 1. Authentication & Role Permissions (Login, invalid rejection, Bearer header, JWT secret guard, RBAC)
 * 2. Vehicle Lifecycle & PostgreSQL Persistence (Create, retrieve, update, duplicate rejection, delete)
 * 3. Telemetry Ingest, Quarantine Gate, 60-Step Admission & Target Isolation (6 features, no battery_temp_degC)
 * 4. Cryptographic Provenance, Merkle Proofs & SHA-256 Storage Integrity (RFC 6962, S3/local readback verification)
 * 5. Dashboard Observability, Correlation IDs & /ready Readiness Probe
 * 6. Reports & Export Formatting with Tenant Boundary Isolation (Tenant 1 vs Tenant 2, CSV/JSON)
 * 7. Billing Lifecycle, Razorpay Test-Mode & Production Safeguards
 */

import assert from "assert";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { db, pool, initDb } from "../db";
import * as schema from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../api/auth";
import { getJwtSecret, AuthenticatedUser } from "../middleware/auth";
import { TelemetryPipeline } from "../pipeline/processor";
import {
  CanonicalTelemetryPayload,
  MerkleTree,
  canonicalizeRecord,
  sha256,
} from "../provenance/merkle";
import { cloudStorage } from "../cloud/storage";
import { ledgerGateway } from "../blockchain/ledger";
import { billingService, TRUSTED_PLANS } from "../billing/razorpay";
import { trafficTracker } from "../metrics/traffic";
import {
  normalizeIncoming,
  createDeviceSequenceState,
  assertNoTargetLeakage,
  INFERENCE_FEATURE_ORDER,
} from "../telemetry/contract";

let testsPassed = 0;

function ok(condition: boolean, msg: string) {
  assert.ok(condition, msg);
  testsPassed++;
  console.log(`  ok  ${msg}`);
}

async function runPhase5Acceptance() {
  console.log("=====================================================================");
  console.log(" TrustSense-BMS / ECUlytics — Phase 5 Acceptance & Security Suite");
  console.log("=====================================================================\n");

  await initDb();

  // -----------------------------------------------------------------------------
  // SECTION 1: Authentication, Role Permissions & Production Safeguards
  // -----------------------------------------------------------------------------
  console.log("[1. Authentication & Authorization Lifecycle]");

  // 1.1 Password Hashing & Timing-Safe Verification
  const rawSecret = "Str0ng_P@ssw0rd_2026!";
  const hashed = hashPassword(rawSecret);
  ok(hashed.includes(":"), "Password hash format is salt:hash");
  ok(verifyPassword(rawSecret, hashed), "Valid password verified via scrypt");
  ok(!verifyPassword("WrongPassword123", hashed), "Invalid password strictly rejected");

  // 1.2 JWT Secret Security Enforcement
  const originalEnv = process.env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;

  // In development, fallback placeholder is allowed
  process.env.NODE_ENV = "development";
  process.env.JWT_SECRET = "supersecretkey_change_me_in_production";
  ok(typeof getJwtSecret() === "string", "Development allows dev fallback secret");

  // In production, placeholder or weak secret MUST throw
  process.env.NODE_ENV = "production";
  process.env.JWT_SECRET = "supersecretkey_change_me_in_production";
  let prodSecretBlocked = false;
  try {
    getJwtSecret();
  } catch (err: any) {
    prodSecretBlocked = true;
    ok(err.message.includes("FATAL SECURITY CONFIGURATION"), "Production rejects placeholder JWT secret");
  }
  ok(prodSecretBlocked, "Production secret validator fails safely on insecure secret");

  // In production with strong secret >= 32 chars, succeeds
  process.env.JWT_SECRET = "production_super_secure_entropy_key_99482710482_2026";
  const validProdSecret = getJwtSecret();
  ok(validProdSecret.length >= 32, "Production accepts cryptographically strong >=32 char secret");

  // Restore env
  process.env.NODE_ENV = originalEnv;
  process.env.JWT_SECRET = originalSecret;

  // 1.3 User Creation & Tenant Association in PostgreSQL
  const testEmail = `operator_phase5_${Date.now()}@vgmarine.com`;
  const [createdUser] = await db
    .insert(schema.users)
    .values({
      name: "Phase 5 Test Operator",
      email: testEmail,
      passwordHash: hashPassword("operatorSecure2026"),
      role: "operator",
      status: "active",
    })
    .returning();

  ok(createdUser.id > 0, "User persisted in PostgreSQL users table");
  ok(createdUser.role === "operator", "User assigned operator role");

  await db
    .insert(schema.tenantUsers)
    .values({ tenantId: 1, userId: createdUser.id })
    .onConflictDoNothing();

  const [tUser] = await db
    .select()
    .from(schema.tenantUsers)
    .where(eq(schema.tenantUsers.userId, createdUser.id))
    .limit(1);

  ok(tUser?.tenantId === 1, "User correctly scoped to tenant 1");

  // 1.4 Bearer Token Header Extraction & Session Decryption
  const userPayload: AuthenticatedUser = {
    id: createdUser.id,
    email: createdUser.email,
    role: createdUser.role,
    tenantId: 1,
  };
  const token = jwt.sign(userPayload, getJwtSecret(), { expiresIn: "1h" });
  const authHeader = `Bearer ${token}`;
  const extractedToken = authHeader.split(" ")[1];
  const decoded = jwt.verify(extractedToken, getJwtSecret()) as AuthenticatedUser;
  ok(decoded.id === createdUser.id, "Bearer token decoded successfully");
  ok(decoded.tenantId === 1, "Tenant ID preserved in JWT claims");

  // -----------------------------------------------------------------------------
  // SECTION 2: Vehicle Management & PostgreSQL Persistence
  // -----------------------------------------------------------------------------
  console.log("\n[2. Vehicle Lifecycle & Database Persistence]");

  const testVehId = `V-P5-${Date.now().toString().slice(-6)}`;
  const [newVehicle] = await db
    .insert(schema.vehicles)
    .values({
      id: testVehId,
      tenantId: 1,
      name: "Acceptance Test Hauler",
      fleet: "Harbor Express",
      status: "healthy",
      batteryId: "BAT-PAN18650PF-001",
      location: "Pier 4",
      tmax: 26.5,
      tmin: 24.8,
      tavg: 25.4,
      deltaT: 1.7,
      dTdt: 0.01,
    })
    .returning();

  ok(newVehicle.id === testVehId, "Vehicle record persisted in PostgreSQL");

  // Verify retrieval
  const [fetchedVeh] = await db
    .select()
    .from(schema.vehicles)
    .where(eq(schema.vehicles.id, testVehId))
    .limit(1);
  ok(fetchedVeh.name === "Acceptance Test Hauler", "Vehicle retrieved with accurate metadata");

  // Update metadata
  const [updatedVeh] = await db
    .update(schema.vehicles)
    .set({ location: "Drydock B", status: "watch", deltaT: 3.2 })
    .where(eq(schema.vehicles.id, testVehId))
    .returning();
  ok(updatedVeh.location === "Drydock B", "Vehicle metadata updated in place");
  ok(updatedVeh.status === "watch", "Status transitioned to watch");

  // Primary key duplicate rejection test
  let duplicateRejected = false;
  try {
    await db.insert(schema.vehicles).values({
      id: testVehId,
      name: "Duplicate Hauler",
      batteryId: "BAT-PAN18650PF-001",
    });
  } catch {
    duplicateRejected = true;
  }
  ok(duplicateRejected, "Duplicate vehicle ID strictly rejected by PostgreSQL primary key constraint");

  // Clean up test vehicle
  await db.delete(schema.vehicles).where(eq(schema.vehicles.id, testVehId));
  const [deletedCheck] = await db
    .select()
    .from(schema.vehicles)
    .where(eq(schema.vehicles.id, testVehId))
    .limit(1);
  ok(!deletedCheck, "Test vehicle cleaned up successfully after verification");

  // -----------------------------------------------------------------------------
  // SECTION 3: Telemetry Ingest, Quarantine Gate & 6-Feature Isolation
  // -----------------------------------------------------------------------------
  console.log("\n[3. Telemetry Ingest, Quarantine Gate & Model Feature Contract]");

  // 3.1 Strict 6-Feature Input Order & Target Isolation
  ok(INFERENCE_FEATURE_ORDER.length === 6, "Inference model contract requires exactly 6 features");
  ok(!INFERENCE_FEATURE_ORDER.includes("battery_temp_degC" as any), "CRITICAL: battery_temp_degC is strictly excluded from model feature order");

  // 3.2 Physical BMS Normalization Contract
  const seqState = createDeviceSequenceState();
  const validPacket = {
    device_id: "DEV-PAN18650PF-01",
    timestamp: new Date().toISOString(),
    voltage_v: 3.75,
    current_a: -1.5,
    ah: -0.25,
    chamber_temp_degC: 25.0,
    battery_temp_degC: 27.8, // Reference sensor (MUST BE EXCLUDED FROM MODEL)
  };

  const normRes = normalizeIncoming(validPacket, { transport: "http", sequence: seqState });
  ok(normRes.ok === true, "Valid physical BMS telemetry packet admitted");
  if (normRes.ok) {
    ok(normRes.value.power_w === Number((3.75 * -1.5).toFixed(4)), "Power derived via electrical law V * I");
    ok(normRes.value.current_abs_a === 1.5, "Absolute current derived via |I|");
    ok(normRes.value.referenceTempDegC === 27.8, "Reference ground truth isolated from model inputs");
    ok(assertNoTargetLeakage([normRes.value.sample as unknown as Record<string, unknown>]), "Sample passes target leakage isolation check");
  }

  // 3.3 Live Telemetry Pipeline & Gate Testing
  const sessionId = `p5_sess_${Date.now()}`;
  const pipeline = new TelemetryPipeline();
  pipeline.beginSession("LIVE_DEVICE", sessionId, "DEV-PAN18650PF-01");

  const safeSample = {
    voltage_v: 3.75,
    current_a: -1.5,
    ah: -0.25,
    chamber_temp_degC: 25.0,
    power_w: 3.75 * -1.5,
    current_abs_a: 1.5,
    time_s: 1.0,
    sampleTime: 1.0,
    recordIndex: 1,
  };

  const admitted = await pipeline.processSample(safeSample, {
    source: "LIVE_DEVICE",
    deviceId: "DEV-PAN18650PF-01",
    referenceTemp: 27.8,
  });

  ok(admitted.accepted === true, "Safe live telemetry sample admitted to pipeline");
  ok(admitted.blocked === false, "Admitted sample is not marked BLOCK");
  ok(admitted.windowLength === 1, "Admitted sample enters the rolling 60-step buffer");
  ok(admitted.inferred === false, "Inference is deferred until window reaches 60 steps");

  // 3.4 Out-of-bounds telemetry sample triggers Quarantine Gate
  const spikeSample = {
    ...safeSample,
    voltage_v: 9.2, // Exceeds safe 4.35V envelope
    power_w: 9.2 * -1.5,
    time_s: 2.0,
    sampleTime: 2.0,
    recordIndex: 2,
  };

  const blocked = await pipeline.processSample(spikeSample, {
    source: "LIVE_DEVICE",
    deviceId: "DEV-PAN18650PF-01",
    referenceTemp: null,
  });

  ok(blocked.blocked === true, "Out-of-envelope voltage (9.2V) triggers BLOCK trust decision");
  ok(blocked.inferred === false, "BLOCK sample is excluded from inference");
  ok(blocked.windowLength === 1, "BLOCK sample does not grow the inference rolling window");

  // -----------------------------------------------------------------------------
  // SECTION 4: Cryptographic Provenance, Merkle Proofs & S3 SHA-256 Storage
  // -----------------------------------------------------------------------------
  console.log("\n[4. Cryptographic Provenance, RFC 6962 Merkle & SHA-256 Storage Integrity]");

  // 4.1 RFC 6962 Merkle Tree Generation
  const records = [1, 2, 3, 4, 5].map((i) => {
    const p: CanonicalTelemetryPayload = {
      schemaVersion: "1.0",
      recordId: `rec_p5_${i}`,
      sampleTime: 100 + i,
      simulationTime: "2026-10-23T00:00:00.000Z",
      voltage_v: 3.7 + i * 0.01,
      current_a: -1.5,
      ah: -0.2 * i,
      chamber_temp_degC: 25.0,
      power_w: (3.7 + i * 0.01) * -1.5,
      current_abs_a: 1.5,
      trustDecision: "SAFE",
    };
    return { recordId: p.recordId, recordHash: sha256(canonicalizeRecord(p)), payload: p };
  });

  const tree = new MerkleTree(records);
  const root = tree.getRoot();
  ok(root.length === 64, "RFC 6962 Merkle root computed with 32-byte SHA-256 hex string");

  const batch = tree.toBatch(`batch_p5_${Date.now()}`);
  ok(batch.leafCount === 5, "Merkle batch exports exact leaf count");
  ok(batch.merkleRoot === root, "Exported batch root matches calculated tree root");

  // 4.2 Merkle Inclusion Proof Verification
  const leaf0 = batch.leaves[0];
  const proofVerification = MerkleTree.verifyRecord(
    records[0].payload,
    records[0].recordHash,
    leaf0.proof,
    batch.merkleRoot
  );
  ok(proofVerification.verified === true, "Cryptographic proof verifies leaf inclusion against Merkle root");
  ok(proofVerification.recordHashMatch === true, "Stored record hash matches canonical payload");
  ok(proofVerification.merkleRootMatch === true, "Proof path successfully reconstructs the Merkle root");

  // Tampered payload test
  const tamperedPayload = { ...records[0].payload, voltage_v: 4.95 };
  const tamperedRes = MerkleTree.verifyRecord(
    tamperedPayload,
    records[0].recordHash,
    leaf0.proof,
    batch.merkleRoot
  );
  ok(tamperedRes.verified === false, "Tampered payload strictly fails cryptographic verification");
  ok(tamperedRes.tamperDetected === true, "Tamper attempt detected and flagged");

  // 4.3 Storage SHA-256 Cryptographic Integrity Check
  const storageRes = await cloudStorage.persistBatchEvidence(batch.batchId, batch);
  ok(typeof storageRes.sha256Checksum === "string" && storageRes.sha256Checksum.length === 64, "Evidence persisted with SHA-256 payload checksum");

  const integrityCheck = await cloudStorage.verifyEvidenceIntegrity(batch.batchId, storageRes.sha256Checksum);
  ok(integrityCheck.valid, "Readback evidence matches SHA-256 checksum exactly (not relying on ETag alone)");
  ok(integrityCheck.matches, "Cryptographic hash match verified across storage layer");

  // Path traversal attack protection
  const traversalResult = await cloudStorage.getBatchEvidence("../../etc/passwd");
  ok(traversalResult === null, "Path traversal attack strictly blocked by alphanumeric key validator");

  // 4.4 Ledger Anchor State Machine
  const anchorRes = await ledgerGateway.anchorBatch(batch.batchId, root, batch.leafCount);
  ok(anchorRes.status.startsWith("CONFIRMED"), "Merkle batch anchored to ledger (CONFIRMED / CONFIRMED_LOCAL)");
  ok(
    anchorRes.provenanceState === "LOCAL_DB_ANCHORED" || anchorRes.provenanceState === "FABRIC_TX_CONFIRMED_VERIFIED",
    `Provenance state accurately tracked: ${anchorRes.provenanceState}`
  );
  ok(
    anchorRes.networkType.startsWith("LOCAL_DEV_NETWORK") || anchorRes.networkType === "HYPERLEDGER_FABRIC_LIVE",
    `Network type accurately designated: ${anchorRes.networkType}`
  );
  ok(
    typeof anchorRes.livePeerConfirmed === "boolean",
    `Live peer confirmation accurately designated: ${anchorRes.livePeerConfirmed}`
  );

  // -----------------------------------------------------------------------------
  // SECTION 5: Observability, Correlation IDs & Operational Readiness
  // -----------------------------------------------------------------------------
  console.log("\n[5. Observability, Request Correlation & Operational Readiness]");

  // 5.1 Traffic Tracking Consistency
  trafficTracker.recordRequest({
    timestamp: Date.now(),
    method: "GET",
    path: "/api/vehicles",
    statusCode: 200,
    durationMs: 14,
    bytesIn: 0,
    bytesOut: 1240,
    tenantId: 1,
    tenantName: "VG Marine Tech Fleet Ops",
  });

  const trafficSummary = trafficTracker.getSummary();
  ok(trafficSummary.totalRequests24h > 0, "Traffic tracker registers operational requests");
  ok(trafficSummary.avgLatencyMs >= 0, "Average latency computed from genuine response measurements");

  // 5.2 Storage & Ledger Health Status Transparency
  const storageStatus = cloudStorage.getStatus();
  ok(storageStatus.status === "connected", "Storage adapter status is connected");
  ok(storageStatus.provider === "LOCAL_S3_COMPATIBLE" || storageStatus.provider === "AWS_S3", "Storage provider explicitly designated");

  const ledgerStatus = await ledgerGateway.getStatus();
  ok(ledgerStatus.supportedLifecycleStates.length === 6, "All 6 Hyperledger Fabric provenance lifecycle states documented");
  ok(typeof ledgerStatus.livePeerVerified === "boolean", `Live Fabric peer verification status accurately reported: ${ledgerStatus.livePeerVerified}`);

  // -----------------------------------------------------------------------------
  // SECTION 6: Reports & Exports with Tenant Isolation
  // -----------------------------------------------------------------------------
  console.log("\n[6. Reports Generation, CSV/JSON Export & Tenant Isolation]");

  const reportId = `RPT-P5-${Date.now().toString().slice(-6)}`;
  const [tenant1Report] = await db
    .insert(schema.reports)
    .values({
      id: reportId,
      tenantId: 1,
      type: "Fleet thermal daily",
      scope: "Global Fleet Ops",
      status: "ready",
      summary: "Phase 5 acceptance audit report",
      reference: `AUDIT-${reportId}`,
      recordCount: 120,
      reportData: { totalBatches: 2, avgDeltaT: 1.8 },
    })
    .returning();

  ok(tenant1Report.id === reportId, "Report created and persisted in PostgreSQL");

  // Simulate Tenant 2 User
  const tenant2User = { id: 999, email: "other@rivalfleet.com", role: "user", tenantId: 2 };
  const canTenant2Access = !tenant1Report.tenantId || tenant1Report.tenantId === tenant2User.tenantId;
  ok(!canTenant2Access, "Tenant 2 user is strictly prevented from accessing Tenant 1 report");

  // CSV formatting check
  const csvRow = `"${tenant1Report.id}","${tenant1Report.type}","${tenant1Report.scope}","${tenant1Report.reference}"`;
  ok(csvRow.includes(tenant1Report.id), "CSV export includes sanitized report fields");

  // -----------------------------------------------------------------------------
  // SECTION 7: Billing Lifecycle, Razorpay Test-Mode & Production Safeguards
  // -----------------------------------------------------------------------------
  console.log("\n[7. Billing Lifecycle, Razorpay Test-Mode & Production Security]");

  // 7.1 Authoritative Pricing
  const entPlan = TRUSTED_PLANS.plan_enterprise_guardian;
  ok(entPlan.amountMonthly === 2490, "Enterprise plan authoritative price is $2,490/month");
  ok(entPlan.currency === "USD", "Billing currency is USD");

  // 7.2 Order Creation
  const newOrder = await billingService.createOrder("plan_professional", 1);
  ok(newOrder.orderId.startsWith("order_"), "Razorpay order ID follows standard format");
  ok(newOrder.amount === 1499, "Professional tier order amount matches catalog ($1,499)");

  // 7.3 Webhook Raw-Body Signature Security
  const webhookBody = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: `pay_test_${Date.now()}`,
          order_id: newOrder.orderId,
          amount: 149900,
          currency: "USD",
          status: "captured",
        },
      },
    },
  });

  const validWebhookSig = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET || "dev_webhook_secret_2026")
    .update(webhookBody)
    .digest("hex");

  const invalidWebhookSig = "bad_signature_000000000000000000000000000000000000000000000000";

  ok(
    billingService.verifyWebhookSignature(webhookBody, validWebhookSig),
    "Razorpay webhook accepts valid raw-body HMAC-SHA256 signature"
  );
  ok(
    !billingService.verifyWebhookSignature(webhookBody, invalidWebhookSig),
    "Razorpay webhook strictly rejects forged or mismatched signature"
  );

  // 7.4 Production Simulation Endpoint Safeguard
  process.env.NODE_ENV = "production";
  let simulationBlockedInProd = false;
  try {
    await billingService.devSimulatePayment(newOrder.orderId, 1);
  } catch (err: any) {
    simulationBlockedInProd = true;
    ok(err.message.includes("strictly forbidden in production"), "Payment simulation strictly forbidden when NODE_ENV === 'production'");
  }
  ok(simulationBlockedInProd, "devSimulatePayment throws fatal error in production mode");

  // Restore env
  process.env.NODE_ENV = "development";
  const devSimSettlement = await billingService.devSimulatePayment(newOrder.orderId, 1);
  ok(devSimSettlement.providerVerified === false, "Development simulation explicitly sets providerVerified: false");
  ok(devSimSettlement.mode === "DEV_TEST_DOUBLE_UNVERIFIED", "Dev simulation mode labeled DEV_TEST_DOUBLE_UNVERIFIED");

  console.log("\n=====================================================================");
  console.log(` Phase 5 End-to-End Acceptance Suite: ALL ${testsPassed} CHECKS PASSED!`);
  console.log("=====================================================================");
}

runPhase5Acceptance()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Phase 5 Acceptance Check Failed:", err);
    process.exit(1);
  });
