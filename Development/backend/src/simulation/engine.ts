/**
 * Dataset replay feeder. Panasonic 18650PF (or synthetic fallback) samples
 * enter the shared TelemetryPipeline — the same path as live device ingest.
 */

import http from "http";
import { db } from "../db";
import * as schema from "../db/schema";
import { TelemetrySample } from "../trust/validator";
import { thermalAiBaseUrl } from "../config";
import { telemetryPipeline } from "../pipeline/processor";
import { acquisitionManager } from "../acquisition/manager";

export interface SimulationState {
  status: "IDLE" | "RUNNING" | "PAUSED" | "STOPPED";
  mode: "DATASET_REPLAY";
  datasetKind: "PANASONIC_MAT" | "SYNTHETIC_FALLBACK";
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
  windowLength: number;
}

export class SimulationEngine {
  private status: "IDLE" | "RUNNING" | "PAUSED" | "STOPPED" = "IDLE";
  private currentCycle = "03-27-17_09.06 10degC_UDDS_Pan18650PF.mat";
  private speed = 1.0;
  private datasetSamples: any[] = [];
  private currentSampleIndex = 0;
  private timer: NodeJS.Timeout | null = null;
  private sessionId = "sim_" + Date.now();
  private datasetKind: "PANASONIC_MAT" | "SYNTHETIC_FALLBACK" = "PANASONIC_MAT";

  constructor() {
    this.loadDataset(this.currentCycle).catch(console.error);
  }

  public async loadDataset(filename: string): Promise<number> {
    this.currentCycle = filename;
    try {
      const url = `${thermalAiBaseUrl()}/api/dataset/load_cycle?filename=${encodeURIComponent(
        filename
      )}&limit=2000`;

      const data = await this.httpGet(url);
      if (data && data.records && data.records.length > 0) {
        this.datasetSamples = data.records;
        this.currentSampleIndex = 0;
        this.datasetKind = "PANASONIC_MAT";
        console.log(
          `[SimulationEngine] Loaded ${this.datasetSamples.length} samples for cycle '${filename}'.`
        );
        return this.datasetSamples.length;
      }
    } catch (e) {
      console.warn(
        `[SimulationEngine] Could not load from FastAPI service: ${e}. Using generated test samples (not physical telemetry).`
      );
    }

    this.datasetSamples = this.generateSyntheticDriveCycle(1000);
    this.datasetKind = "SYNTHETIC_FALLBACK";
    this.currentSampleIndex = 0;
    return this.datasetSamples.length;
  }

  public async start(): Promise<SimulationState> {
    if (this.status === "RUNNING") {
      return this.getState(); // Prevent duplicate replay loops
    }

    const pipe = telemetryPipeline.getState();
    if (pipe.activeSource === "LIVE_DEVICE") {
      acquisitionManager.disconnect("switched_to_dataset_replay");
      await telemetryPipeline.endSession();
    }

    if (this.datasetSamples.length === 0) {
      await this.loadDataset(this.currentCycle);
    }

    if (this.status === "IDLE" || this.status === "STOPPED") {
      this.sessionId = "sim_" + Date.now();
      this.currentSampleIndex = 0;
      telemetryPipeline.beginSession("DATASET_REPLAY", this.sessionId, null);

      try {
        await db.insert(schema.simulationSessions).values({
          id: this.sessionId,
          datasetName: `${this.datasetKind}:${this.currentCycle}`,
          status: "RUNNING",
          speed: this.speed,
          totalSamples: this.datasetSamples.length,
          processedSamples: 0,
          sourceMode: "DATASET_REPLAY",
        } as any);
      } catch (e) {
        console.warn("[SimulationEngine] Failed to save simulation session to db:", e);
      }
    }

    this.status = "RUNNING";
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.scheduleNextTick();
    console.log(`[SimulationEngine] DATASET_REPLAY RUNNING at ${this.speed}x (${this.datasetKind}).`);
    return this.getState();
  }

  public pause(): SimulationState {
    this.status = "PAUSED";
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    return this.getState();
  }

  public async stop(): Promise<SimulationState> {
    this.status = "STOPPED";
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (telemetryPipeline.getState().activeSource === "DATASET_REPLAY") {
      await telemetryPipeline.endSession();
    }
    return this.getState();
  }

  public async reset(): Promise<SimulationState> {
    await this.stop();
    this.currentSampleIndex = 0;
    this.status = "IDLE";
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

  public injectTestAnomaly(
    type: "voltage_spike" | "current_surge" | "power_mismatch" | "nan_value"
  ): void {
    if (this.datasetSamples.length > 0 && this.currentSampleIndex < this.datasetSamples.length) {
      const s = { ...this.datasetSamples[this.currentSampleIndex] };
      if (type === "voltage_spike") s.voltage_v = 8.5;
      if (type === "current_surge") s.current_a = 99.0;
      if (type === "power_mismatch") s.power_w = -999.0;
      if (type === "nan_value") s.voltage_v = NaN;
      this.datasetSamples[this.currentSampleIndex] = s;
    }
  }

  private async tick(): Promise<void> {
    if (this.status !== "RUNNING") return;

    if (this.currentSampleIndex >= this.datasetSamples.length) {
      await this.stop();
      return;
    }

    const rawSample = this.datasetSamples[this.currentSampleIndex];
    this.currentSampleIndex++;

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

    await telemetryPipeline.processSample(sample, {
      source: "DATASET_REPLAY",
      deviceId: null,
      recordId: `rec_${this.sessionId}_${this.currentSampleIndex.toString().padStart(6, "0")}`,
      referenceTemp: groundTruthRefTemp,
    });

    this.scheduleNextTick();
  }

  private scheduleNextTick(): void {
    if (this.status !== "RUNNING") return;
    const intervalMs = Math.max(50, Math.floor(1000 / this.speed));
    this.timer = setTimeout(() => this.tick(), intervalMs);
  }

  public getState(): SimulationState {
    const p = telemetryPipeline.getState();
    return {
      status: this.status,
      mode: "DATASET_REPLAY",
      datasetKind: this.datasetKind,
      currentCycle: this.currentCycle,
      speed: this.speed,
      totalSamples: this.datasetSamples.length,
      currentSampleIndex: this.currentSampleIndex,
      validWindowsProcessed: p.validWindowsProcessed,
      failedInferenceCount: p.failedInferenceCount,
      quarantinedCount: p.quarantinedCount,
      activeBatchIndex: p.activeBatchIndex,
      latestPredictedTemp: p.latestPredictedTemp,
      latestReferenceTemp: p.latestReferenceTemp,
      latestResidual: p.latestResidual,
      runningMae: p.runningMae,
      latestTrustDecision: p.latestTrustDecision,
      latestRecordHash: p.latestRecordHash,
      latestMerkleRoot: p.latestMerkleRoot,
      latestTxId: p.latestTxId,
      sessionId: this.sessionId,
      windowLength: p.windowLength,
    };
  }

  public addSseClient(res: any): void {
    telemetryPipeline.addSseClient(res, { state: this.getState() });
  }

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
