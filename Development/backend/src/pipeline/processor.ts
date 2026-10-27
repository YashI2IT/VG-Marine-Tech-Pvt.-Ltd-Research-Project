/**
 * Shared TrustSense pipeline: trust gate → 60-step buffer → CNN-LSTM
 * → SHA-256 → Merkle batch → local evidence / local ledger adapter → SSE.
 *
 * Used by dataset replay and physical-device acquisition. Windows are exclusive
 * per active source so replay samples never mix with live device samples.
 */

import http from "http";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";
import { TrustValidator, TelemetrySample, TrustDecision } from "../trust/validator";
import {
  canonicalizeRecord,
  sha256,
  MerkleTree,
  CanonicalTelemetryPayload,
} from "../provenance/merkle";
import { ledgerGateway } from "../blockchain/ledger";
import { cloudStorage } from "../cloud/storage";
import { thermalAiBaseUrl } from "../config";
import { assertNoTargetLeakage, DataSourceType } from "../telemetry/contract";
import { loadTelemetryConfig } from "../acquisition/config";

export interface PipelineState {
  activeSource: DataSourceType | "IDLE";
  sessionId: string | null;
  deviceId: string | null;
  windowLength: number;
  sequenceLength: number;
  validWindowsProcessed: number;
  failedInferenceCount: number;
  quarantinedCount: number;
  rejectedIngestCount: number;
  processedSamples: number;
  latestPredictedTemp: number | null;
  latestReferenceTemp: number | null;
  latestResidual: number | null;
  runningMae: number | null;
  latestTrustDecision: string;
  latestRecordHash: string | null;
  latestMerkleRoot: string | null;
  latestTxId: string | null;
  latestInferenceLatencyMs: number | null;
  lastInferenceError: string | null;
  lastSampleAt: string | null;
  persistenceStatus: "idle" | "postgres" | "postgres_unavailable";
  evidenceStatus: "idle" | "local_filesystem" | "aws_s3";
  ledgerStatus: "idle" | "local_dev_adapter";
  windowResetReason: string | null;
  activeBatchIndex: number;
}

export interface ProcessMeta {
  source: DataSourceType;
  deviceId: string | null;
  recordId?: string | null;
  referenceTemp: number | null;
  derivedFields?: string[];
  transport?: string;
}

export class TelemetryPipeline {
  private validator = new TrustValidator();
  private windowBuffer: TelemetrySample[] = [];
  private readonly sequenceLength = 60;
  private readonly batchSize = 30;
  private currentBatchRecords: {
    recordId: string;
    recordHash: string;
    payload: CanonicalTelemetryPayload;
  }[] = [];
  private batchIndex = 0;
  private absoluteErrors: number[] = [];
  private validWindowsProcessed = 0;
  private failedInferenceCount = 0;
  private quarantinedCount = 0;
  private rejectedIngestCount = 0;
  private processedSamples = 0;
  private lastSampleTimeS: number | null = null;

  private activeSource: DataSourceType | "IDLE" = "IDLE";
  private sessionId: string | null = null;
  private deviceId: string | null = null;
  private latestPredictedTemp: number | null = null;
  private latestReferenceTemp: number | null = null;
  private latestResidual: number | null = null;
  private latestTrustDecision = "SAFE";
  private latestRecordHash: string | null = null;
  private latestMerkleRoot: string | null = null;
  private latestTxId: string | null = null;
  private latestInferenceLatencyMs: number | null = null;
  private lastInferenceError: string | null = null;
  private lastSampleAt: string | null = null;
  private persistenceStatus: PipelineState["persistenceStatus"] = "idle";
  private evidenceStatus: PipelineState["evidenceStatus"] = "idle";
  private ledgerStatus: PipelineState["ledgerStatus"] = "idle";
  private windowResetReason: string | null = null;
  private sseClients: any[] = [];

  public getSequenceLength(): number {
    return this.sequenceLength;
  }

  public getWindowSnapshot(): TelemetrySample[] {
    return [...this.windowBuffer];
  }

  public beginSession(source: DataSourceType, sessionId: string, deviceId: string | null): void {
    this.activeSource = source;
    this.sessionId = sessionId;
    this.deviceId = deviceId;
    this.windowBuffer = [];
    this.currentBatchRecords = [];
    this.batchIndex = 0;
    this.validator.reset();
    this.absoluteErrors = [];
    this.validWindowsProcessed = 0;
    this.failedInferenceCount = 0;
    this.quarantinedCount = 0;
    this.rejectedIngestCount = 0;
    this.processedSamples = 0;
    this.lastSampleTimeS = null;
    this.latestPredictedTemp = null;
    this.latestReferenceTemp = null;
    this.latestResidual = null;
    this.latestTrustDecision = "SAFE";
    this.latestRecordHash = null;
    this.latestMerkleRoot = null;
    this.latestTxId = null;
    this.latestInferenceLatencyMs = null;
    this.lastInferenceError = null;
    this.windowResetReason = null;
  }

  public async endSession(): Promise<void> {
    if (this.currentBatchRecords.length > 0) {
      await this.finalizeBatch();
    }
    this.activeSource = "IDLE";
  }

  public noteIngestRejection(): void {
    this.rejectedIngestCount++;
  }

  public handleDisconnect(): void {
    this.windowBuffer = [];
    this.lastSampleTimeS = null;
    this.validator.reset();
    this.windowResetReason = "device_disconnected";
    this.activeSource = "IDLE";
    this.broadcastEvent({
      type: "DEVICE_DISCONNECTED",
      deviceId: this.deviceId,
      timestamp: new Date().toISOString(),
      pipeline: this.getState(),
    });
  }

  public async processSample(sample: TelemetrySample, meta: ProcessMeta): Promise<{
    accepted: boolean;
    blocked: boolean;
    inferred: boolean;
    recordId: string;
    trustResult: TrustDecision;
    prediction: any;
    windowLength: number;
    reason?: string;
  }> {
    if (this.activeSource !== "IDLE" && this.activeSource !== meta.source) {
      return {
        accepted: false,
        blocked: false,
        inferred: false,
        recordId: "",
        trustResult: {
          decision: "BLOCK",
          confidence: 0,
          reasons: [`Pipeline is exclusive to ${this.activeSource}`],
          passedChecks: [],
          violations: [`SOURCE_EXCLUSIVE: active ${this.activeSource}`],
          metrics: {
            voltage: sample.voltage_v,
            current: sample.current_a,
            calculatedPower: sample.voltage_v * sample.current_a,
            powerDiscrepancy: 0,
          },
          timestamp: new Date().toISOString(),
        },
        prediction: null,
        windowLength: this.windowBuffer.length,
        reason: `exclusive_mode_${this.activeSource}`,
      };
    }

    if (this.activeSource === "IDLE") {
      const sid =
        meta.source === "LIVE_DEVICE"
          ? `dev_${meta.deviceId || "unknown"}_${Date.now()}`
          : `sim_${Date.now()}`;
      this.beginSession(meta.source, sid, meta.deviceId);
      try {
        await db.insert(schema.simulationSessions).values({
          id: sid,
          datasetName:
            meta.source === "LIVE_DEVICE"
              ? `live:${meta.deviceId || "unknown"}`
              : "dataset-replay",
          status: "RUNNING",
          sourceMode: meta.source,
          deviceId: meta.deviceId,
        } as any);
      } catch (e) {
        console.warn("[Pipeline] session insert failed:", e);
      }
    }

    if (meta.deviceId && this.deviceId !== meta.deviceId) {
      this.deviceId = meta.deviceId;
      this.lastSampleTimeS = null;
    }

    const cfg = loadTelemetryConfig();
    if (
      meta.source === "LIVE_DEVICE" &&
      this.lastSampleTimeS !== null &&
      sample.sampleTime !== undefined
    ) {
      const gap = sample.sampleTime - this.lastSampleTimeS;
      if (gap > cfg.maxGapS) {
        this.windowBuffer = [];
        this.validator.reset();
        this.windowResetReason = `non_consecutive_gap_${gap.toFixed(3)}s`;
        this.broadcastEvent({
          type: "WINDOW_RESET",
          reason: this.windowResetReason,
          deviceId: meta.deviceId,
          pipeline: this.getState(),
        });
      }
    }

    this.processedSamples++;
    this.lastSampleAt = new Date().toISOString();
    this.deviceId = meta.deviceId || this.deviceId;
    const recordId =
      meta.recordId ||
      `rec_${this.sessionId}_${this.processedSamples.toString().padStart(6, "0")}`;
    sample.recordIndex = this.processedSamples;
    sample.sampleTime = sample.sampleTime ?? sample.time_s;
    const simulationTime = new Date().toISOString();

    const trustResult = this.validator.validate(sample);
    this.latestTrustDecision = trustResult.decision;

    if (trustResult.decision === "BLOCK") {
      this.quarantinedCount++;
      try {
        await db.insert(schema.quarantinedRecords).values({
          id: `q_${recordId}`,
          sessionId: this.sessionId,
          recordIndex: this.processedSamples,
          payload: { ...sample, deviceId: meta.deviceId, dataSource: meta.source },
          violationReasons: trustResult.violations,
          trustDecision: "BLOCK",
        });
        this.persistenceStatus = "postgres";
      } catch (e) {
        this.persistenceStatus = "postgres_unavailable";
        console.warn("[Pipeline] Failed to save quarantined record:", e);
      }

      this.broadcastEvent({
        type: "TELEMETRY_BLOCKED",
        recordId,
        dataSource: meta.source,
        deviceId: meta.deviceId,
        trustResult,
        sample,
        quarantinedCount: this.quarantinedCount,
        inferred: false,
        pipeline: this.getState(),
      });

      return {
        accepted: false,
        blocked: true,
        inferred: false,
        recordId,
        trustResult,
        prediction: null,
        windowLength: this.windowBuffer.length,
      };
    }

    this.lastSampleTimeS = sample.sampleTime ?? sample.time_s ?? this.lastSampleTimeS;
    this.windowBuffer.push(sample);
    if (this.windowBuffer.length > this.sequenceLength) {
      this.windowBuffer.shift();
    }

    let predictionResult: any = null;
    let inferred = false;
    if (this.windowBuffer.length === this.sequenceLength) {
      predictionResult = await this.callInference(
        this.windowBuffer,
        meta.referenceTemp,
        `win_${recordId}`
      );

      if (predictionResult && predictionResult.status === "SUCCESS") {
        inferred = true;
        this.validWindowsProcessed++;
        this.latestPredictedTemp = predictionResult.predicted_temp_degC;
        this.latestReferenceTemp = predictionResult.reference_temp_degC;
        this.latestResidual = predictionResult.residual_degC;
        this.latestInferenceLatencyMs = predictionResult.latency_ms ?? null;
        this.lastInferenceError = null;

        if (predictionResult.absolute_error_degC !== null) {
          this.absoluteErrors.push(predictionResult.absolute_error_degC);
          if (this.absoluteErrors.length > 500) this.absoluteErrors.shift();
        }

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
          this.persistenceStatus = "postgres_unavailable";
          console.warn("[Pipeline] Failed to save prediction record:", e);
        }
      } else {
        this.failedInferenceCount++;
        this.lastInferenceError =
          predictionResult?.error || "Inference service unavailable or returned non-SUCCESS";
        this.broadcastEvent({
          type: "INFERENCE_FAILED",
          recordId,
          dataSource: meta.source,
          error: this.lastInferenceError,
          pipeline: this.getState(),
        });
      }
    }

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

    const recordHash = sha256(canonicalizeRecord(canonicalPayload));
    this.latestRecordHash = recordHash;

    try {
      await db.insert(schema.telemetryRecords).values({
        id: recordId,
        sessionId: this.sessionId,
        recordIndex: this.processedSamples,
        sampleTime: sample.sampleTime || 0,
        simulationTime: new Date(simulationTime),
        voltageV: sample.voltage_v,
        currentA: sample.current_a,
        ah: sample.ah,
        chamberTempDegC: sample.chamber_temp_degC,
        powerW: sample.power_w,
        currentAbsA: sample.current_abs_a,
        referenceTempDegC: meta.referenceTemp,
        trustDecision: trustResult.decision,
        recordHash,
        deviceId: meta.deviceId,
        dataSource: meta.source,
      } as any);
      this.persistenceStatus = "postgres";
    } catch (e) {
      this.persistenceStatus = "postgres_unavailable";
      console.warn("[Pipeline] Failed to save telemetry record:", e);
    }

    this.currentBatchRecords.push({ recordId, recordHash, payload: canonicalPayload });
    if (this.currentBatchRecords.length >= this.batchSize) {
      await this.finalizeBatch();
    }

    this.broadcastEvent({
      type: "LIVE_TELEMETRY",
      recordId,
      recordIndex: this.processedSamples,
      dataSource: meta.source,
      deviceId: meta.deviceId,
      transport: meta.transport || null,
      derivedFields: meta.derivedFields || [],
      sample,
      trustResult,
      windowReadiness: `${this.windowBuffer.length}/${this.sequenceLength}`,
      prediction: predictionResult,
      runningMae: this.getRunningMae(),
      recordHash,
      inferenceLatencyMs: this.latestInferenceLatencyMs,
      persistenceStatus: this.persistenceStatus,
      evidenceStatus: this.evidenceStatus,
      ledgerStatus: this.ledgerStatus,
      activeBatchProgress: `${this.currentBatchRecords.length}/${this.batchSize}`,
      latestMerkleRoot: this.latestMerkleRoot,
      latestTxId: this.latestTxId,
      state: this.getState(),
      pipeline: this.getState(),
    });

    return {
      accepted: true,
      blocked: false,
      inferred,
      recordId,
      trustResult,
      prediction: predictionResult,
      windowLength: this.windowBuffer.length,
    };
  }

  public async finalizeBatch(): Promise<void> {
    if (this.currentBatchRecords.length === 0) return;

    this.batchIndex++;
    const batchId = `batch_${this.sessionId}_${this.batchIndex}`;
    const recordsToBatch = [...this.currentBatchRecords];
    this.currentBatchRecords = [];

    try {
      const tree = new MerkleTree(recordsToBatch);
      const batchResult = tree.toBatch(batchId);
      this.latestMerkleRoot = batchResult.merkleRoot;

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
      this.evidenceStatus = storageRes.storageProvider === "AWS_S3" ? "aws_s3" : "local_filesystem";

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
      this.ledgerStatus = "local_dev_adapter";

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
        storageProvider: storageRes.storageProvider,
        sha256Checksum: storageRes.sha256Checksum,
        uploadedAt: storageRes.storageProvider === "AWS_S3" ? new Date() : null,
        tenantId: 1,
        status: "COMMITTED",
      });

      for (const rec of recordsToBatch) {
        await db
          .update(schema.telemetryRecords)
          .set({ batchId })
          .where(eq(schema.telemetryRecords.id, rec.recordId));
      }

      this.broadcastEvent({
        type: "BATCH_ANCHORED",
        batchId,
        merkleRoot: batchResult.merkleRoot,
        leafCount: batchResult.leafCount,
        fabricTxId: anchor.fabricTxId,
        blockNumber: anchor.blockNumber,
        evidenceUrl: storageRes.url,
        storageProvider: storageRes.storageProvider,
        ledgerNetworkType: anchor.networkType,
        liveFabric: false,
        awsS3: storageRes.storageProvider === "AWS_S3",
      });
    } catch (e) {
      console.error("[Pipeline] Error finalizing Merkle batch:", e);
    }
  }

  private async callInference(
    window: TelemetrySample[],
    referenceTemp: number | null,
    windowId: string
  ): Promise<any> {
    const rows = window.map((w) => ({
      voltage_v: w.voltage_v,
      current_a: w.current_a,
      ah: w.ah,
      chamber_temp_degC: w.chamber_temp_degC,
      power_w: w.power_w,
      current_abs_a: w.current_abs_a,
      time_s: w.time_s,
    }));
    if (!assertNoTargetLeakage(rows)) {
      return { status: "FAILED", error: "Target leakage blocked: temperature in window" };
    }
    if (rows.length !== this.sequenceLength) {
      return { status: "FAILED", error: `Window length ${rows.length} != ${this.sequenceLength}` };
    }

    const postData = JSON.stringify({
      window: rows,
      reference_temp_degC: referenceTemp,
      window_id: windowId,
      model_variant: "cnn-lstm-baseline",
    });

    try {
      return await this.httpPost(`${thermalAiBaseUrl()}/api/predict/window`, postData);
    } catch (err) {
      console.warn("[Pipeline] FastAPI inference call failed:", err);
      return null;
    }
  }

  private getRunningMae(): number | null {
    if (this.absoluteErrors.length === 0) return null;
    const sum = this.absoluteErrors.reduce((a, b) => a + b, 0);
    return Math.round((sum / this.absoluteErrors.length) * 1000) / 1000;
  }

  public getState(): PipelineState {
    return {
      activeSource: this.activeSource,
      sessionId: this.sessionId,
      deviceId: this.deviceId,
      windowLength: this.windowBuffer.length,
      sequenceLength: this.sequenceLength,
      validWindowsProcessed: this.validWindowsProcessed,
      failedInferenceCount: this.failedInferenceCount,
      quarantinedCount: this.quarantinedCount,
      rejectedIngestCount: this.rejectedIngestCount,
      processedSamples: this.processedSamples,
      latestPredictedTemp: this.latestPredictedTemp,
      latestReferenceTemp: this.latestReferenceTemp,
      latestResidual: this.latestResidual,
      runningMae: this.getRunningMae(),
      latestTrustDecision: this.latestTrustDecision,
      latestRecordHash: this.latestRecordHash,
      latestMerkleRoot: this.latestMerkleRoot,
      latestTxId: this.latestTxId,
      latestInferenceLatencyMs: this.latestInferenceLatencyMs,
      lastInferenceError: this.lastInferenceError,
      lastSampleAt: this.lastSampleAt,
      persistenceStatus: this.persistenceStatus,
      evidenceStatus: this.evidenceStatus,
      ledgerStatus: this.ledgerStatus,
      windowResetReason: this.windowResetReason,
      activeBatchIndex: this.batchIndex,
    };
  }

  public addSseClient(res: any, extra: Record<string, unknown> = {}): void {
    this.sseClients.push(res);
    res.write(
      `data: ${JSON.stringify({
        type: "INITIAL_STATE",
        pipeline: this.getState(),
        ...extra,
      })}\n\n`
    );
    res.on("close", () => {
      this.sseClients = this.sseClients.filter((c) => c !== res);
    });
  }

  public broadcastEvent(eventData: any): void {
    const payload = `data: ${JSON.stringify(eventData)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(payload);
      } catch {}
    }
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
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error("Inference request timed out after 5000ms"));
      });
      req.on("error", reject);
      req.write(postBody);
      req.end();
    });
  }
}

export const telemetryPipeline = new TelemetryPipeline();
