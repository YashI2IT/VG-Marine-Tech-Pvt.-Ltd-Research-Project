/**
 * TrustSense-BMS Telemetry Simulator & Live Pipeline Engine
 * 
 * Orchestrates the full pipeline:
 * 1. Replays real Panasonic 18650PF drive cycle datasets
 * 2. Pre-inference Cybersecurity & Physics Plausibility Validation
 * 3. Sliding 60-step sequence buffer management
 * 4. Real-time Thermal AI Inference (CNN-LSTM) without target leakage
 * 5. Deterministic SHA-256 Record Hashing
 * 6. Merkle Tree Batching (30 samples per batch)
 * 7. Hyperledger Fabric Ledger Anchoring
 * 8. Real-time SSE broadcasting to dashboard
 */

import http from "http";
import crypto from "crypto";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";
import { TrustValidator, TelemetrySample, TrustDecision } from "../trust/validator";
import {
  canonicalizeRecord,
  sha256,
  MerkleTree,
  CanonicalTelemetryPayload,
  MerkleLeaf,
} from "../provenance/merkle";
import { ledgerGateway } from "../blockchain/ledger";
import { cloudStorage } from "../cloud/storage";

export interface SimulationState {
  status: "IDLE" | "RUNNING" | "PAUSED" | "STOPPED";
  currentCycle: string;
  speed: number;
  totalSamples: number;
  currentSampleIndex: number;
  validWindowsProcessed: number;
  failedInferenceCount: number;
  quarantinedCount: number;
  activeBatchIndex: number;
  latestPredictedTemp: number | null;
  latestReferenceTemp: number | null;
  latestResidual: number | null;
  runningMae: number | null;
  latestTrustDecision: string;
  latestRecordHash: string | null;
  latestMerkleRoot: string | null;
  latestTxId: string | null;
  sessionId: string;
}

export class SimulationEngine {
  private status: "IDLE" | "RUNNING" | "PAUSED" | "STOPPED" = "IDLE";
  private currentCycle = "03-27-17_09.06 10degC_UDDS_Pan18650PF.mat";
  private speed = 1.0; // 1x = 1 sample per second
  private datasetSamples: any[] = [];
  private currentSampleIndex = 0;
  private timer: NodeJS.Timeout | null = null;
  private sessionId = "sim_" + Date.now();

  // Sliding 60-step buffer
  private windowBuffer: TelemetrySample[] = [];
  private readonly sequenceLength = 60;

  // Running metrics
  private absoluteErrors: number[] = [];
  private validWindowsProcessed = 0;
  private failedInferenceCount = 0;
  private quarantinedCount = 0;

  // Merkle batching (batch size = 30 records)
  private readonly batchSize = 30;
  private currentBatchRecords: {
    recordId: string;
    recordHash: string;
    payload: CanonicalTelemetryPayload;
  }[] = [];
  private batchIndex = 0;

  // Latest pipeline snapshots
  private latestPredictedTemp: number | null = null;
  private latestReferenceTemp: number | null = null;
  private latestResidual: number | null = null;
  private latestTrustDecision = "SAFE";
  private latestRecordHash: string | null = null;
  private latestMerkleRoot: string | null = null;
  private latestTxId: string | null = null;

  // Components
  private validator = new TrustValidator();
  private sseClients: any[] = [];

  constructor() {
    // Initial default dataset cycle preload
    this.loadDataset(this.currentCycle).catch(console.error);
  }

  /**
   * Load a Panasonic 18650PF dataset cycle from the FastAPI inference service.
   */
  public async loadDataset(filename: string): Promise<number> {
    this.currentCycle = filename;
    try {
      const url = `http://127.0.0.1:8000/api/dataset/load_cycle?filename=${encodeURIComponent(
        filename
      )}&limit=2000`;

      const data = await this.httpGet(url);
      if (data && data.records && data.records.length > 0) {
        this.datasetSamples = data.records;
        this.currentSampleIndex = 0;
        console.log(`[SimulationEngine] Loaded ${this.datasetSamples.length} samples for cycle '${filename}'.`);
        return this.datasetSamples.length;
      }
    } catch (e) {
      console.warn(`[SimulationEngine] Could not load from FastAPI service: ${e}. Using generated test samples.`);
    }

    // Fallback generated samples if microservice isn't reachable
    this.datasetSamples = this.generateSyntheticDriveCycle(1000);
    this.currentSampleIndex = 0;
    return this.datasetSamples.length;
  }

  /**
   * Start or resume simulation.
   */
  public async start(): Promise<SimulationState> {
    if (this.datasetSamples.length === 0) {
      await this.loadDataset(this.currentCycle);
    }

    if (this.status === "IDLE" || this.status === "STOPPED") {
      this.sessionId = "sim_" + Date.now();
      this.currentSampleIndex = 0;
      this.windowBuffer = [];
      this.currentBatchRecords = [];
      this.validator.reset();
      this.absoluteErrors = [];
      this.validWindowsProcessed = 0;
      this.failedInferenceCount = 0;
      this.quarantinedCount = 0;

      // Register session in PostgreSQL
      try {
        await db.insert(schema.simulationSessions).values({
          id: this.sessionId,
          datasetName: this.currentCycle,
          status: "RUNNING",
          speed: this.speed,
          totalSamples: this.datasetSamples.length,
          processedSamples: 0,
        });
      } catch (e) {
        console.warn("[SimulationEngine] Failed to save simulation session to db:", e);
      }
    }

    this.status = "RUNNING";
    this.scheduleNextTick();
    console.log(`[SimulationEngine] Simulation RUNNING at ${this.speed}x speed.`);
    return this.getState();
  }

  public pause(): SimulationState {
    this.status = "PAUSED";
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    console.log("[SimulationEngine] Simulation PAUSED.");
    return this.getState();
  }

  public async stop(): Promise<SimulationState> {
    this.status = "STOPPED";
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;

    // Finalize any pending batch
    if (this.currentBatchRecords.length > 0) {
      await this.finalizeBatch();
    }

    console.log("[SimulationEngine] Simulation STOPPED.");
    return this.getState();
  }

  public async reset(): Promise<SimulationState> {
    await this.stop();
    this.currentSampleIndex = 0;
    this.windowBuffer = [];
    this.currentBatchRecords = [];
    this.validator.reset();
    this.absoluteErrors = [];
    this.validWindowsProcessed = 0;
    this.failedInferenceCount = 0;
    this.quarantinedCount = 0;
    this.latestPredictedTemp = null;
    this.latestReferenceTemp = null;
    this.latestResidual = null;
    this.status = "IDLE";
    console.log("[SimulationEngine] Simulation RESET.");
    return this.getState();
  }

  public setSpeed(speed: number): SimulationState {
    this.speed = Math.max(0.2, Math.min(20.0, speed));
    if (this.status === "RUNNING") {
      if (this.timer) clearTimeout(this.timer);
      this.scheduleNextTick();
    }
    return this.getState();
  }

  /**
   * Inject a test anomaly (for verifying cyber/physics trust blocking)
   */
  public injectTestAnomaly(type: "voltage_spike" | "current_surge" | "power_mismatch" | "nan_value"): void {
    if (this.datasetSamples.length > 0 && this.currentSampleIndex < this.datasetSamples.length) {
      const s = { ...this.datasetSamples[this.currentSampleIndex] };
      if (type === "voltage_spike") s.voltage_v = 8.5; // Impossible for 18650 cell
      if (type === "current_surge") s.current_a = 99.0;
      if (type === "power_mismatch") s.power_w = -999.0;
      if (type === "nan_value") s.voltage_v = NaN;
      this.datasetSamples[this.currentSampleIndex] = s;
      console.log(`[SimulationEngine] ⚠️ Injected test anomaly '${type}' at index ${this.currentSampleIndex}`);
    }
  }

  /**
   * Main simulation tick execution.
   */
  private async tick(): Promise<void> {
    if (this.status !== "RUNNING") return;

    if (this.currentSampleIndex >= this.datasetSamples.length) {
      console.log("[SimulationEngine] Reached end of dataset. Stopping.");
      await this.stop();
      return;
    }

    const rawSample = this.datasetSamples[this.currentSampleIndex];
    this.currentSampleIndex++;

    const recordId = `rec_${this.sessionId}_${this.currentSampleIndex.toString().padStart(6, "0")}`;
    const simulationTime = new Date().toISOString();

    const sample: TelemetrySample = {
      voltage_v: Number(rawSample.voltage_v),
      current_a: Number(rawSample.current_a),
      ah: Number(rawSample.ah),
      chamber_temp_degC: Number(rawSample.chamber_temp_degC),
      power_w: Number(rawSample.power_w ?? rawSample.voltage_v * rawSample.current_a),
      current_abs_a: Number(rawSample.current_abs_a ?? Math.abs(rawSample.current_a)),
      time_s: Number(rawSample.time_s ?? this.currentSampleIndex),
      sampleTime: Number(rawSample.time_s ?? this.currentSampleIndex),
      recordIndex: this.currentSampleIndex,
    };

    const groundTruthRefTemp =
      rawSample.battery_temp_degC !== undefined && !isNaN(rawSample.battery_temp_degC)
        ? Number(rawSample.battery_temp_degC)
        : null;

    // 1. Pre-Inference Trust Validation
    const trustResult: TrustDecision = this.validator.validate(sample);
    this.latestTrustDecision = trustResult.decision;

    // Handle BLOCK: Quarantine record and reject from sliding window
    if (trustResult.decision === "BLOCK") {
      this.quarantinedCount++;
      try {
        await db.insert(schema.quarantinedRecords).values({
          id: `q_${recordId}`,
          sessionId: this.sessionId,
          recordIndex: this.currentSampleIndex,
          payload: sample,
          violationReasons: trustResult.violations,
          trustDecision: "BLOCK",
        });
      } catch (e) {
        console.warn("[SimulationEngine] Failed to save quarantined record:", e);
      }

      this.broadcastEvent({
        type: "TELEMETRY_BLOCKED",
        recordId,
        trustResult,
        sample,
        quarantinedCount: this.quarantinedCount,
      });

      this.scheduleNextTick();
      return;
    }

    // 2. Add SAFE / SUSPICIOUS sample to 60-step sliding window buffer
    this.windowBuffer.push(sample);
    if (this.windowBuffer.length > this.sequenceLength) {
      this.windowBuffer.shift();
    }

    // 3. Thermal AI Inference (only when window has reached 60 valid samples)
    let predictionResult: any = null;
    if (this.windowBuffer.length === this.sequenceLength) {
      predictionResult = await this.callInference(
        this.windowBuffer,
        groundTruthRefTemp,
        `win_${recordId}`
      );

      if (predictionResult && predictionResult.status === "SUCCESS") {
        this.validWindowsProcessed++;
        this.latestPredictedTemp = predictionResult.predicted_temp_degC;
        this.latestReferenceTemp = predictionResult.reference_temp_degC;
        this.latestResidual = predictionResult.residual_degC;

        if (predictionResult.absolute_error_degC !== null) {
          this.absoluteErrors.push(predictionResult.absolute_error_degC);
          if (this.absoluteErrors.length > 500) this.absoluteErrors.shift();
        }

        // Persist prediction to PostgreSQL
        try {
          await db.insert(schema.predictionRecords).values({
            id: `pred_${recordId}`,
            recordId,
            sessionId: this.sessionId,
            windowId: `win_${recordId}`,
            predictedTempDegC: predictionResult.predicted_temp_degC,
            referenceTempDegC: predictionResult.reference_temp_degC,
            residualDegC: predictionResult.residual_degC,
            absoluteErrorDegC: predictionResult.absolute_error_degC,
            latencyMs: predictionResult.latency_ms,
            modelVersion: predictionResult.model_version || "1.0.0",
            confidence: predictionResult.confidence || "VALID",
            oodStatus: predictionResult.ood_status || "IN-DISTRIBUTION",
            status: "SUCCESS",
          });
        } catch (e) {
          console.warn("[SimulationEngine] Failed to save prediction record:", e);
        }
      } else {
        this.failedInferenceCount++;
      }
    }

    // 4. Cryptographic Hashing & Off-Chain Persistence
    const canonicalPayload: CanonicalTelemetryPayload = {
      schemaVersion: "1.0",
      recordId,
      sampleTime: sample.sampleTime || 0,
      simulationTime,
      voltage_v: sample.voltage_v,
      current_a: sample.current_a,
      ah: sample.ah,
      chamber_temp_degC: sample.chamber_temp_degC,
      power_w: sample.power_w,
      current_abs_a: sample.current_abs_a,
      trustDecision: trustResult.decision,
    };

    const canonicalString = canonicalizeRecord(canonicalPayload);
    const recordHash = sha256(canonicalString);
    this.latestRecordHash = recordHash;

    // Persist telemetry record to PostgreSQL
    try {
      await db.insert(schema.telemetryRecords).values({
        id: recordId,
        sessionId: this.sessionId,
        recordIndex: this.currentSampleIndex,
        sampleTime: sample.sampleTime || 0,
        simulationTime: new Date(simulationTime),
        voltageV: sample.voltage_v,
        currentA: sample.current_a,
        ah: sample.ah,
        chamberTempDegC: sample.chamber_temp_degC,
        powerW: sample.power_w,
        currentAbsA: sample.current_abs_a,
        referenceTempDegC: groundTruthRefTemp,
        trustDecision: trustResult.decision,
        recordHash,
      });
    } catch (e) {
      console.warn("[SimulationEngine] Failed to save telemetry record:", e);
    }

    // 5. Accumulate into Merkle Batch
    this.currentBatchRecords.push({
      recordId,
      recordHash,
      payload: canonicalPayload,
    });

    if (this.currentBatchRecords.length >= this.batchSize) {
      await this.finalizeBatch();
    }

    // 6. Broadcast SSE live event to dashboard
    this.broadcastEvent({
      type: "LIVE_TELEMETRY",
      recordId,
      recordIndex: this.currentSampleIndex,
      sample,
      trustResult,
      windowReadiness: `${this.windowBuffer.length}/${this.sequenceLength}`,
      prediction: predictionResult,
      runningMae: this.getRunningMae(),
      recordHash,
      activeBatchProgress: `${this.currentBatchRecords.length}/${this.batchSize}`,
      latestMerkleRoot: this.latestMerkleRoot,
      latestTxId: this.latestTxId,
      state: this.getState(),
    });

    this.scheduleNextTick();
  }

  /**
   * Finalize current batch of records into a Merkle tree and anchor to Fabric ledger.
   */
  private async finalizeBatch(): Promise<void> {
    if (this.currentBatchRecords.length === 0) return;

    this.batchIndex++;
    const batchId = `batch_${this.sessionId}_${this.batchIndex}`;
    const recordsToBatch = [...this.currentBatchRecords];
    this.currentBatchRecords = [];

    try {
      // 1. Build Merkle Tree
      const tree = new MerkleTree(recordsToBatch);
      const batchResult = tree.toBatch(batchId);
      this.latestMerkleRoot = batchResult.merkleRoot;

      // 2. Persist evidence file (cloud storage / local S3)
      const storageRes = await cloudStorage.persistBatchEvidence(batchId, {
        batchId,
        merkleRoot: batchResult.merkleRoot,
        leafCount: batchResult.leafCount,
        sessionId: this.sessionId,
        records: recordsToBatch.map((r, i) => ({
          recordId: r.recordId,
          recordHash: r.recordHash,
          leafHash: batchResult.leaves[i].leafHash,
          proof: batchResult.leaves[i].proof,
          canonicalPayload: r.payload,
        })),
      });

      // 3. Anchor Merkle Root to Hyperledger Fabric
      const startId = recordsToBatch[0].recordId;
      const endId = recordsToBatch[recordsToBatch.length - 1].recordId;
      const anchor = await ledgerGateway.anchorBatch(
        batchId,
        batchResult.merkleRoot,
        batchResult.leafCount,
        startId,
        endId,
        "1.0.0"
      );
      this.latestTxId = anchor.fabricTxId;

      // 4. Persist batch record in PostgreSQL
      await db.insert(schema.merkleBatches).values({
        id: batchId,
        sessionId: this.sessionId,
        batchIndex: this.batchIndex,
        merkleRoot: batchResult.merkleRoot,
        leafCount: batchResult.leafCount,
        startRecordId: startId,
        endRecordId: endId,
        leaves: batchResult.leaves,
        treeStructure: batchResult.treeLevels,
        s3ObjectKey: storageRes.s3Key,
        status: "COMMITTED",
      });

      // 5. Update batchId on telemetry records
      for (const rec of recordsToBatch) {
        await db
          .update(schema.telemetryRecords)
          .set({ batchId })
          .where(eq(schema.telemetryRecords.id, rec.recordId));
      }

      console.log(`[SimulationEngine] ⚓ Merkle Batch ${batchId} finalized & anchored to Fabric. Root: ${batchResult.merkleRoot.slice(0, 16)}...`);

      this.broadcastEvent({
        type: "BATCH_ANCHORED",
        batchId,
        merkleRoot: batchResult.merkleRoot,
        leafCount: batchResult.leafCount,
        fabricTxId: anchor.fabricTxId,
        blockNumber: anchor.blockNumber,
        evidenceUrl: storageRes.url,
      });
    } catch (e) {
      console.error("[SimulationEngine] Error finalizing Merkle batch:", e);
    }
  }

  /**
   * Schedule next tick according to speed.
   */
  private scheduleNextTick(): void {
    if (this.status !== "RUNNING") return;
    const intervalMs = Math.max(50, Math.floor(1000 / this.speed));
    this.timer = setTimeout(() => this.tick(), intervalMs);
  }

  /**
   * Call Thermal AI inference service.
   */
  private async callInference(
    window: TelemetrySample[],
    referenceTemp: number | null,
    windowId: string
  ): Promise<any> {
    const postData = JSON.stringify({
      window: window.map((w) => ({
        voltage_v: w.voltage_v,
        current_a: w.current_a,
        ah: w.ah,
        chamber_temp_degC: w.chamber_temp_degC,
        power_w: w.power_w,
        current_abs_a: w.current_abs_a,
        time_s: w.time_s,
      })),
      reference_temp_degC: referenceTemp,
      window_id: windowId,
      model_variant: "cnn-lstm-baseline",
    });

    try {
      const res = await this.httpPost("http://127.0.0.1:8000/api/predict/window", postData);
      return res;
    } catch (err) {
      console.warn("[SimulationEngine] FastAPI inference call failed:", err);
      return null;
    }
  }

  private getRunningMae(): number | null {
    if (this.absoluteErrors.length === 0) return null;
    const sum = this.absoluteErrors.reduce((a, b) => a + b, 0);
    return Math.round((sum / this.absoluteErrors.length) * 1000) / 1000;
  }

  public getState(): SimulationState {
    return {
      status: this.status,
      currentCycle: this.currentCycle,
      speed: this.speed,
      totalSamples: this.datasetSamples.length,
      currentSampleIndex: this.currentSampleIndex,
      validWindowsProcessed: this.validWindowsProcessed,
      failedInferenceCount: this.failedInferenceCount,
      quarantinedCount: this.quarantinedCount,
      activeBatchIndex: this.batchIndex,
      latestPredictedTemp: this.latestPredictedTemp,
      latestReferenceTemp: this.latestReferenceTemp,
      latestResidual: this.latestResidual,
      runningMae: this.getRunningMae(),
      latestTrustDecision: this.latestTrustDecision,
      latestRecordHash: this.latestRecordHash,
      latestMerkleRoot: this.latestMerkleRoot,
      latestTxId: this.latestTxId,
      sessionId: this.sessionId,
    };
  }

  // --- SSE Subscription Management ---
  public addSseClient(res: any): void {
    this.sseClients.push(res);
    // Send initial handshake state
    res.write(`data: ${JSON.stringify({ type: "INITIAL_STATE", state: this.getState() })}\n\n`);

    res.on("close", () => {
      this.sseClients = this.sseClients.filter((c) => c !== res);
    });
  }

  private broadcastEvent(eventData: any): void {
    const payload = `data: ${JSON.stringify(eventData)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(payload);
      } catch {}
    }
  }

  // --- HTTP Helpers ---
  private httpGet(urlStr: string): Promise<any> {
    return new Promise((resolve, reject) => {
      http
        .get(urlStr, (res) => {
          let b = "";
          res.on("data", (c) => (b += c));
          res.on("end", () => {
            try {
              resolve(JSON.parse(b));
            } catch (err) {
              reject(err);
            }
          });
        })
        .on("error", reject);
    });
  }

  private httpPost(urlStr: string, postBody: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const u = new URL(urlStr);
      const req = http.request(
        {
          hostname: u.hostname,
          port: u.port,
          path: u.pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postBody),
          },
        },
        (res) => {
          let b = "";
          res.on("data", (c) => (b += c));
          res.on("end", () => {
            try {
              resolve(JSON.parse(b));
            } catch (err) {
              reject(err);
            }
          });
        }
      );
      req.on("error", reject);
      req.write(postBody);
      req.end();
    });
  }

  private generateSyntheticDriveCycle(count: number): any[] {
    const samples: any[] = [];
    let ah = 0;
    for (let i = 0; i < count; i++) {
      const v = 3.6 + 0.3 * Math.sin(i / 50.0);
      const cur = -1.5 + 2.0 * Math.sin(i / 20.0);
      ah += (cur * 1.0) / 3600.0;
      samples.push({
        recordIndex: i,
        time_s: i,
        voltage_v: Math.round(v * 1000) / 1000,
        current_a: Math.round(cur * 100) / 100,
        ah: Math.round(ah * 10000) / 10000,
        chamber_temp_degC: 10.0,
        power_w: Math.round(v * cur * 1000) / 1000,
        current_abs_a: Math.round(Math.abs(cur) * 100) / 100,
        battery_temp_degC: Math.round((10.0 + 3.0 * Math.sin(i / 80.0)) * 100) / 100,
      });
    }
    return samples;
  }
}

export const simulationEngine = new SimulationEngine();
