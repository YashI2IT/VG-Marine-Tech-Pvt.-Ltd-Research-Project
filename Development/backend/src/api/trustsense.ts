/**
 * TrustSense-BMS API Routes
 * 
 * Endpoints for:
 * - Simulation Replay Control & Real-time SSE Stream
 * - Thermal AI Model Health & Benchmarks
 * - Cybersecurity Trust & Anomaly Injection
 * - Cryptographic Provenance & Step-by-Step Verification
 * - Tampering Demonstration & Audit Trail
 * - Digital Battery Passport & Fabric Ledger State
 */

import express, { Request, Response } from "express";
import http from "http";
import { simulationEngine } from "../simulation/engine";
import { telemetryPipeline } from "../pipeline/processor";
import { acquisitionManager } from "../acquisition/manager";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq, desc, isNotNull, count } from "drizzle-orm";
import {
  canonicalizeRecord,
  sha256,
  MerkleTree,
  CanonicalTelemetryPayload,
  MerkleProofStep,
  MerkleLeaf,
} from "../provenance/merkle";
import { ledgerGateway } from "../blockchain/ledger";
import { cloudStorage } from "../cloud/storage";
import { thermalAiBaseUrl } from "../config";

const router = express.Router();

async function loadPersistenceCounts() {
  try {
    const [telemetry, predictions, quarantined, batches, anchors] = await Promise.all([
      db.select({ n: count() }).from(schema.telemetryRecords),
      db.select({ n: count() }).from(schema.predictionRecords),
      db.select({ n: count() }).from(schema.quarantinedRecords),
      db.select({ n: count() }).from(schema.merkleBatches),
      db.select({ n: count() }).from(schema.ledgerAnchors),
    ]);
    return {
      persistenceAvailable: true,
      telemetryRecords: Number(telemetry[0]?.n ?? 0),
      predictionRecords: Number(predictions[0]?.n ?? 0),
      quarantinedRecords: Number(quarantined[0]?.n ?? 0),
      merkleBatches: Number(batches[0]?.n ?? 0),
      ledgerAnchors: Number(anchors[0]?.n ?? 0),
    };
  } catch {
    return {
      persistenceAvailable: false,
      telemetryRecords: null,
      predictionRecords: null,
      quarantinedRecords: null,
      merkleBatches: null,
      ledgerAnchors: null,
    };
  }
}

/**
 * GET /api/trustsense/status
 * Unified system status for UI panels
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const simState = simulationEngine.getState();
    const pipelineState = telemetryPipeline.getState();
    const acquisition = acquisitionManager.getStatus();
    const ledgerStatus = await ledgerGateway.getStatus();
    const storageStatus = cloudStorage.getStatus();

    let modelStatus = { status: "unknown", ready: false };
    try {
      const resp = await new Promise<any>((resolve) => {
        const req = http
          .get(`${thermalAiBaseUrl()}/health`, (r) => {
            let b = "";
            r.on("data", (c) => (b += c));
            r.on("end", () => {
              try {
                resolve(JSON.parse(b));
              } catch {
                resolve({ status: "error", ready: false });
              }
            });
          });
        req.setTimeout(2000, () => {
          req.destroy();
          resolve({ status: "timeout", ready: false });
        });
        req.on("error", () => resolve({ status: "offline", ready: false }));
      });
      modelStatus = resp;
    } catch {}

    const counts = await loadPersistenceCounts();

    res.json({
      pipeline: "TrustSense-BMS Battery Thermal Intelligence",
      status: "operational",
      simulation: simState,
      pipelineState,
      acquisition,
      model: modelStatus,
      ledger: ledgerStatus,
      storage: storageStatus,
      counts,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error fetching trust status:", err);
    res.status(500).json({ error: "Failed to fetch TrustSense-BMS status" });
  }
});

/**
 * GET /api/trustsense/cycles
 * List available real Panasonic 18650PF drive cycles
 */
router.get("/cycles", async (req: Request, res: Response) => {
  try {
    const cyclesRes = await new Promise<any>((resolve) => {
      const req = http
        .get(`${thermalAiBaseUrl()}/api/dataset/cycles`, (r) => {
          let b = "";
          r.on("data", (c) => (b += c));
          r.on("end", () => {
            try {
              resolve(JSON.parse(b));
            } catch {
              resolve({ count: 0, cycles: [] });
            }
          });
        });
      req.setTimeout(2000, () => {
        req.destroy();
        resolve({ count: 0, cycles: [] });
      });
      req.on("error", () => resolve({ count: 0, cycles: [] }));
    });
    res.json(cyclesRes);
  } catch (err) {
    res.status(500).json({ error: "Failed to list cycles" });
  }
});

/**
 * POST /api/trustsense/simulation/control
 * Control playback: start, pause, stop, reset, speed, cycle
 */
router.post("/simulation/control", async (req: Request, res: Response) => {
  const { action, value } = req.body;

  try {
    let state;
    switch (action) {
      case "start":
        state = await simulationEngine.start();
        break;
      case "pause":
        state = simulationEngine.pause();
        break;
      case "stop":
        state = await simulationEngine.stop();
        break;
      case "reset":
        state = await simulationEngine.reset();
        break;
      case "speed":
        state = simulationEngine.setSpeed(Number(value) || 1.0);
        break;
      case "cycle":
        if (typeof value === "string") {
          await simulationEngine.stop();
          await simulationEngine.loadDataset(value);
          state = simulationEngine.getState();
        }
        break;
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    res.json({ success: true, action, state });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Simulation control error" });
  }
});

/**
 * GET /api/trustsense/simulation/stream
 * Server-Sent Events (SSE) live telemetry, prediction, and trust channel
 */
router.get("/simulation/stream", (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  simulationEngine.addSseClient(res);
});

/**
 * POST /api/trustsense/telemetry/ingest
 * Physical BMS / gateway HTTP ingestion (read-only). Optional header X-Telemetry-Token.
 */
router.post("/telemetry/ingest", async (req: Request, res: Response) => {
  if (!acquisitionManager.authorize(req.header("x-telemetry-token") || undefined)) {
    return res.status(401).json({ error: "Invalid or missing X-Telemetry-Token" });
  }
  try {
    const result = await acquisitionManager.ingestHttp(req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Ingest failed" });
  }
});

/**
 * GET /api/trustsense/telemetry/status
 */
router.get("/telemetry/status", (_req: Request, res: Response) => {
  res.json({
    acquisition: acquisitionManager.getStatus(),
    pipeline: telemetryPipeline.getState(),
  });
});

/**
 * POST /api/trustsense/simulation/anomaly
 * Inject a test anomaly to test live trust layer blocking
 */
router.post("/simulation/anomaly", (req: Request, res: Response) => {
  const { type } = req.body;
  if (!["voltage_spike", "current_surge", "power_mismatch", "nan_value"].includes(type)) {
    return res.status(400).json({ error: "Invalid anomaly type." });
  }

  simulationEngine.injectTestAnomaly(type);
  res.json({ success: true, message: `Injected test anomaly '${type}'. Watch the Trust Panel block it!` });
});

/**
 * GET /api/trustsense/provenance/batches
 * List recent Merkle batches committed to the ledger
 */
router.get("/provenance/batches", async (req: Request, res: Response) => {
  try {
    const batches = await db
      .select()
      .from(schema.merkleBatches)
      .orderBy(desc(schema.merkleBatches.createdAt))
      .limit(20);

    const anchors = await db
      .select()
      .from(schema.ledgerAnchors)
      .orderBy(desc(schema.ledgerAnchors.createdAt))
      .limit(20);

    const anchorMap = new Map(anchors.map((a) => [a.batchId, a]));

    const combined = batches.map((b) => ({
      ...b,
      anchor: anchorMap.get(b.id) || null,
    }));

    res.json({ count: combined.length, batches: combined });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/trustsense/provenance/verify/:recordId
 * Independent cryptographic verification of a stored record
 */
router.get("/provenance/verify/:recordId", async (req: Request, res: Response) => {
  const { recordId } = req.params;

  try {
    // 1. Fetch telemetry record from DB
    const records = await db
      .select()
      .from(schema.telemetryRecords)
      .where(eq(schema.telemetryRecords.id, recordId as string))
      .limit(1);

    if (records.length === 0) {
      return res.status(404).json({ error: `Record '${recordId}' not found.` });
    }

    const rec = records[0];
    if (!rec.batchId) {
      return res.json({
        verified: false,
        recordId,
        reason: "Record is still in active buffer and has not yet been sealed into a Merkle batch.",
      });
    }

    // 2. Fetch Merkle batch
    const batches = await db
      .select()
      .from(schema.merkleBatches)
      .where(eq(schema.merkleBatches.id, rec.batchId))
      .limit(1);

    if (batches.length === 0) {
      return res.status(404).json({ error: `Batch '${rec.batchId}' not found.` });
    }

    const batch = batches[0];
    const leaves = batch.leaves as MerkleLeaf[];
    const leaf = leaves.find((l) => l.recordId === recordId);

    if (!leaf) {
      return res.status(404).json({ error: `Record leaf not found in batch '${rec.batchId}'.` });
    }

    // 3. Reconstruct Canonical Payload
    const canonicalPayload: CanonicalTelemetryPayload = {
      schemaVersion: "1.0",
      recordId: rec.id,
      sampleTime: rec.sampleTime,
      simulationTime: rec.simulationTime.toISOString(),
      voltage_v: rec.voltageV,
      current_a: rec.currentA,
      ah: rec.ah,
      chamber_temp_degC: rec.chamberTempDegC,
      power_w: rec.powerW,
      current_abs_a: rec.currentAbsA,
      trustDecision: rec.trustDecision,
    };

    // 4. Verify against on-chain Fabric anchor
    const verification = MerkleTree.verifyRecord(
      canonicalPayload,
      rec.recordHash,
      leaf.proof,
      batch.merkleRoot
    );

    const onChainAnchor = await ledgerGateway.verifyOnChain(
      rec.batchId,
      rec.recordHash,
      leaf.proof
    );

    res.json({
      ...verification,
      batchId: rec.batchId,
      onChainAnchor,
      evidenceUrl: `/api/trustsense/evidence/${rec.batchId}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/trustsense/provenance/tamper_test
 * Demonstrates tamper detection by modifying a committed record
 */
router.post("/provenance/tamper_test", async (req: Request, res: Response) => {
  const { recordId, fieldToTamper, tamperedValue } = req.body;

  try {
    // Pick the latest batched record if none specified
    let targetId = recordId;
    if (!targetId) {
      const latest = await db
        .select()
        .from(schema.telemetryRecords)
        .where(isNotNull(schema.telemetryRecords.batchId))
        .orderBy(desc(schema.telemetryRecords.createdAt))
        .limit(1);

      if (latest.length === 0) {
        return res.status(400).json({ error: "No committed batches available yet. Run simulation first." });
      }
      targetId = latest[0].id;
    }

    const recs = await db
      .select()
      .from(schema.telemetryRecords)
      .where(eq(schema.telemetryRecords.id, targetId))
      .limit(1);

    if (recs.length === 0) return res.status(404).json({ error: "Record not found" });
    const rec = recs[0];

    const batches = await db
      .select()
      .from(schema.merkleBatches)
      .where(eq(schema.merkleBatches.id, rec.batchId!))
      .limit(1);

    const batch = batches[0];
    const leaves = batch.leaves as MerkleLeaf[];
    const leaf = leaves.find((l) => l.recordId === targetId)!;

    // Normal canonical payload
    const originalPayload: CanonicalTelemetryPayload = {
      schemaVersion: "1.0",
      recordId: rec.id,
      sampleTime: rec.sampleTime,
      simulationTime: rec.simulationTime.toISOString(),
      voltage_v: rec.voltageV,
      current_a: rec.currentA,
      ah: rec.ah,
      chamber_temp_degC: rec.chamberTempDegC,
      power_w: rec.powerW,
      current_abs_a: rec.currentAbsA,
      trustDecision: rec.trustDecision,
    };

    // Deliberately tampered payload
    const tamperedPayload: any = { ...originalPayload };
    const field = fieldToTamper || "voltage_v";
    const oldVal = (originalPayload as any)[field];
    const newVal = tamperedValue !== undefined ? tamperedValue : (typeof oldVal === "number" ? oldVal + 0.5 : "TAMPERED");
    tamperedPayload[field] = newVal;

    const originalCanonical = canonicalizeRecord(originalPayload);
    const tamperedCanonical = canonicalizeRecord(tamperedPayload);

    const originalHash = sha256(originalCanonical);
    const tamperedHash = sha256(tamperedCanonical);

    // Verify original (should PASS)
    const originalCheck = MerkleTree.verifyRecord(
      originalPayload,
      rec.recordHash,
      leaf.proof,
      batch.merkleRoot
    );

    // Verify tampered (must FAIL!)
    const tamperedCheck = MerkleTree.verifyRecord(
      tamperedPayload,
      rec.recordHash,
      leaf.proof,
      batch.merkleRoot
    );

    res.json({
      test: "Deliberate Tamper Detection Demonstration",
      targetRecordId: targetId,
      batchId: rec.batchId,
      anchoredMerkleRoot: batch.merkleRoot,
      tamperingApplied: {
        field,
        originalValue: oldVal,
        tamperedValue: newVal,
      },
      hashComparison: {
        storedRecordHash: rec.recordHash,
        calculatedOriginalHash: originalHash,
        calculatedTamperedHash: tamperedHash,
        hashMatchesStored: tamperedHash === rec.recordHash,
      },
      auditResult: {
        originalVerification: originalCheck.verified ? "VERIFIED (Pass)" : "FAILED",
        tamperedVerification: tamperedCheck.verified ? "VERIFIED" : "FAILED (Tampering Caught!)",
        tamperDetected: tamperedCheck.tamperDetected,
        auditLogs: tamperedCheck.details,
      },
      conclusion: "Cryptographic SHA-256 and Merkle proof guarantee tamper evidence. Any modification to off-chain data fails mathematical verification.",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/trustsense/evidence/:batchId
 * Fetch full off-chain evidence manifest for a batch (protected against directory traversal & cross-tenant access)
 */
router.get("/evidence/:batchId", async (req: Request, res: Response) => {
  const batchId = req.params.batchId as string;
  if (!/^[a-zA-Z0-9_\-]+$/.test(batchId)) {
    return res.status(400).json({ error: "Invalid batch ID format." });
  }

  const user = (req as any).user;
  const tenantId = user?.tenantId;
  const userRole = user?.role;

  try {
    const evidence = await cloudStorage.getBatchEvidence(batchId, tenantId, userRole);
    if (!evidence) {
      return res.status(404).json({ error: `Evidence file for batch '${batchId}' not found.` });
    }
    res.json(evidence);
  } catch (err: any) {
    if (err.status === 403) {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: "Failed to retrieve evidence." });
  }
});

/**
 * POST /api/trustsense/storage/probe
 * Tests genuine AWS S3 upload, readback, integrity check, and cleanup
 */
router.post("/storage/probe", async (req: Request, res: Response) => {
  try {
    const result = await cloudStorage.probeLiveS3Connection();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});


/**
 * GET /api/trustsense/passport/:batteryId
 * Fetch digital battery passport
 */
router.get("/passport/:batteryId", async (req: Request, res: Response) => {
  const batteryId = req.params.batteryId as string;
  try {
    const passport = await ledgerGateway.getBatteryPassport(batteryId);
    if (!passport) {
      return res.status(404).json({ error: `Passport for '${batteryId}' not found.` });
    }
    res.json(passport);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/trustsense/quarantine
 * List quarantined records
 */
router.get("/quarantine", async (req: Request, res: Response) => {
  try {
    const records = await db
      .select()
      .from(schema.quarantinedRecords)
      .orderBy(desc(schema.quarantinedRecords.createdAt))
      .limit(50);
    res.json({ count: records.length, records });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
