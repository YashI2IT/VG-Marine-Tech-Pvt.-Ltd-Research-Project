import { loadTelemetryConfig, TelemetryRuntimeConfig } from "./config";
import {
  createDeviceSequenceState,
  DeviceSequenceState,
  IncomingTelemetryPacket,
  NormalizedTelemetry,
  normalizeIncoming,
  TransportType,
} from "../telemetry/contract";
import { telemetryPipeline } from "../pipeline/processor";
import { simulationEngine } from "../simulation/engine";

export interface AcquisitionStatus {
  connected: boolean;
  waitingForTelemetry: boolean;
  deviceId: string | null;
  transportsConfigured: TransportType[];
  transportsActive: TransportType[];
  mqtt: { enabled: boolean; connected: boolean; broker: string | null; topic: string; reason: string | null };
  serial: { enabled: boolean; connected: boolean; path: string | null; reason: string | null };
  http: { enabled: true; ingestPath: string };
  lastMessageAt: string | null;
  lastError: string | null;
  missingFeaturesLast: string[];
}

export class AcquisitionManager {
  private cfg: TelemetryRuntimeConfig;
  private sequences = new Map<string, DeviceSequenceState>();
  private connected = false;
  private deviceId: string | null = null;
  private lastMessageAt: string | null = null;
  private lastError: string | null = null;
  private missingFeaturesLast: string[] = [];
  private mqttClient: { end: (force: boolean, cb?: () => void) => void } | null = null;
  private mqttConnected = false;
  private mqttReason: string | null = null;
  private serialPort: { close: () => void } | null = null;
  private serialConnected = false;
  private serialReason: string | null = null;
  private staleTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.cfg = loadTelemetryConfig();
  }

  public getStatus(): AcquisitionStatus {
    const stale =
      this.lastMessageAt !== null &&
      Date.now() - Date.parse(this.lastMessageAt) > this.cfg.staleMs;
    return {
      connected: this.connected && !stale,
      waitingForTelemetry: !this.connected || stale,
      deviceId: this.deviceId,
      transportsConfigured: this.cfg.transports,
      transportsActive: [
        ...(this.mqttConnected ? (["mqtt"] as TransportType[]) : []),
        ...(this.serialConnected ? (["serial"] as TransportType[]) : []),
        "http",
      ],
      mqtt: {
        enabled: this.cfg.transports.includes("mqtt"),
        connected: this.mqttConnected,
        broker: this.cfg.mqttBrokerUrl,
        topic: this.cfg.mqttTopic,
        reason: this.mqttReason,
      },
      serial: {
        enabled: this.cfg.transports.includes("serial"),
        connected: this.serialConnected,
        path: this.cfg.serialPath,
        reason: this.serialReason,
      },
      http: { enabled: true, ingestPath: "/api/trustsense/telemetry/ingest" },
      lastMessageAt: this.lastMessageAt,
      lastError: this.lastError,
      missingFeaturesLast: this.missingFeaturesLast,
    };
  }

  public authorize(tokenHeader: string | undefined): boolean {
    if (!this.cfg.ingestToken) return true;
    return tokenHeader === this.cfg.ingestToken;
  }

  public async start(): Promise<void> {
    this.cfg = loadTelemetryConfig();
    if (this.cfg.transports.includes("mqtt")) {
      await this.startMqtt();
    } else {
      this.mqttReason = "mqtt not in TELEMETRY_TRANSPORT";
    }
    if (this.cfg.transports.includes("serial")) {
      await this.startSerial();
    } else {
      this.serialReason = "serial not in TELEMETRY_TRANSPORT";
    }
    this.watchStale();
    console.log(
      `[Acquisition] HTTP ingest ready. MQTT=${this.cfg.transports.includes("mqtt")} SERIAL=${this.cfg.transports.includes("serial")}`
    );
  }

  public async stop(): Promise<void> {
    if (this.staleTimer) clearInterval(this.staleTimer);
    if (this.mqttClient) {
      this.mqttClient.end(true);
      this.mqttClient = null;
      this.mqttConnected = false;
    }
    if (this.serialPort) {
      try {
        this.serialPort.close();
      } catch {}
      this.serialPort = null;
      this.serialConnected = false;
    }
    this.markDisconnected("stopped");
  }

  public ingestHttp(packet: IncomingTelemetryPacket) {
    return this.acceptPacket(packet, "http");
  }

  public ingestRaw(text: string, transport: TransportType) {
    let parsed: IncomingTelemetryPacket;
    try {
      parsed = JSON.parse(text);
    } catch {
      telemetryPipeline.noteIngestRejection();
      telemetryPipeline.broadcastEvent({
        type: "TELEMETRY_REJECTED",
        code: "MALFORMED",
        reasons: ["payload is not JSON"],
        transport,
      });
      return { ok: false as const, status: 400, body: { error: "payload is not JSON", code: "MALFORMED" } };
    }
    return this.acceptPacket(parsed, transport);
  }

  private async acceptPacket(packet: IncomingTelemetryPacket, transport: TransportType) {
    const deviceHint =
      (typeof packet.device_id === "string" && packet.device_id) || this.cfg.defaultDeviceId;
    if (!this.sequences.has(deviceHint)) {
      this.sequences.set(deviceHint, createDeviceSequenceState());
    }
    const sequence = this.sequences.get(deviceHint)!;
    const result = normalizeIncoming(packet, {
      transport,
      receivedAtMs: Date.now(),
      sequence,
      config: this.cfg,
    });

    if (!result.ok) {
      telemetryPipeline.noteIngestRejection();
      this.lastError = result.reasons.join("; ");
      this.missingFeaturesLast = result.missingFeatures;
      telemetryPipeline.broadcastEvent({
        type: "TELEMETRY_REJECTED",
        code: result.code,
        reasons: result.reasons,
        missingFeatures: result.missingFeatures,
        transport,
      });
      return { ok: false as const, status: 400, body: result };
    }

    return this.acceptNormalized(result.value);
  }

  private async acceptNormalized(value: NormalizedTelemetry) {
    const replayStatus = simulationEngine.getState().status;
    if (replayStatus === "RUNNING" || replayStatus === "PAUSED") {
      return {
        ok: false as const,
        status: 409,
        body: {
          error: "Dataset replay is running. Pause/stop replay before sending live device telemetry.",
          code: "REPLAY_ACTIVE",
        },
      };
    }

    this.connected = true;
    this.deviceId = value.deviceId;
    this.lastMessageAt = new Date().toISOString();
    this.lastError = null;
    this.missingFeaturesLast = [];

    const processed = await telemetryPipeline.processSample(value.sample, {
      source: "LIVE_DEVICE",
      deviceId: value.deviceId,
      recordId: value.recordId,
      referenceTemp: value.referenceTempDegC,
      derivedFields: value.derivedFields,
      transport: value.transport,
    });

    return {
      ok: true as const,
      status: processed.accepted || processed.blocked ? 202 : 409,
      body: {
        accepted: processed.accepted,
        blocked: processed.blocked,
        inferred: processed.inferred,
        recordId: processed.recordId,
        windowLength: processed.windowLength,
        sequenceLength: telemetryPipeline.getSequenceLength(),
        trustDecision: processed.trustResult.decision,
        violations: processed.trustResult.violations,
        prediction: processed.prediction,
        predictedTemp: processed.prediction?.predicted_temp_degC ?? null,
        latencyMs: processed.prediction?.latency_ms ?? null,
        residualDegC: processed.prediction?.residual_degC ?? null,
        derivedFields: value.derivedFields,
        deviceId: value.deviceId,
        dataSource: "LIVE_DEVICE",
        reason: processed.reason,
      },
    };
  }

  public disconnect(reason = "manual_disconnect"): void {
    this.markDisconnected(reason);
  }

  private markDisconnected(reason: string) {
    const wasConnected = this.connected;
    this.connected = false;
    this.lastError = reason;
    if (wasConnected) {
      telemetryPipeline.handleDisconnect();
    }
  }

  private watchStale() {
    if (this.staleTimer) clearInterval(this.staleTimer);
    this.staleTimer = setInterval(() => {
      if (!this.lastMessageAt || !this.connected) return;
      if (Date.now() - Date.parse(this.lastMessageAt) > this.cfg.staleMs) {
        this.markDisconnected("stale_timeout");
      }
    }, Math.min(1000, this.cfg.staleMs));
  }

  private async startMqtt(): Promise<void> {
    if (!this.cfg.mqttBrokerUrl) {
      this.mqttReason = "MQTT_BROKER_URL is not set";
      return;
    }
    try {
      // Dynamic import so HTTP-only deployments do not require the client until configured.
      const mqtt = await import("mqtt");
      const client = mqtt.connect(this.cfg.mqttBrokerUrl, {
        clientId: this.cfg.mqttClientId,
        username: this.cfg.mqttUsername || undefined,
        password: this.cfg.mqttPassword || undefined,
        reconnectPeriod: 4000,
      });
      this.mqttClient = client;
      client.on("connect", () => {
        this.mqttConnected = true;
        this.mqttReason = null;
        client.subscribe(this.cfg.mqttTopic, (err: Error | null) => {
          if (err) this.mqttReason = err.message;
        });
        telemetryPipeline.broadcastEvent({ type: "DEVICE_STATUS", transport: "mqtt", connected: true });
      });
      client.on("reconnect", () => {
        this.mqttConnected = false;
        this.mqttReason = "reconnecting";
      });
      client.on("close", () => {
        this.mqttConnected = false;
        this.markDisconnected("mqtt_closed");
      });
      client.on("error", (err: Error) => {
        this.mqttReason = err.message;
      });
      client.on("message", (_topic: string, payload: Buffer) => {
        this.ingestRaw(payload.toString("utf8"), "mqtt");
      });
    } catch (e: any) {
      this.mqttReason = e?.message || "mqtt package failed to load. Run npm install mqtt.";
    }
  }

  private async startSerial(): Promise<void> {
    if (!this.cfg.serialPath) {
      this.serialReason = "TELEMETRY_SERIAL_PATH is not set";
      return;
    }
    try {
      const serialport = await import("serialport");
      const { SerialPort } = serialport as any;
      const parserMod = await import("@serialport/parser-readline").catch(() => null);
      const port = new SerialPort({ path: this.cfg.serialPath, baudRate: this.cfg.serialBaud });
      this.serialPort = port;
      port.on("open", () => {
        this.serialConnected = true;
        this.serialReason = null;
        telemetryPipeline.broadcastEvent({ type: "DEVICE_STATUS", transport: "serial", connected: true });
      });
      port.on("close", () => {
        this.serialConnected = false;
        this.markDisconnected("serial_closed");
      });
      port.on("error", (err: Error) => {
        this.serialReason = err.message;
        this.serialConnected = false;
      });

      const onLine = (line: string) => this.ingestRaw(line.trim(), "serial");
      if (parserMod) {
        const parser = port.pipe(new (parserMod as any).ReadlineParser({ delimiter: "\n" }));
        parser.on("data", onLine);
      } else {
        let buf = "";
        port.on("data", (chunk: Buffer) => {
          buf += chunk.toString("utf8");
          const parts = buf.split(/\r?\n/);
          buf = parts.pop() || "";
          for (const line of parts) if (line.trim()) onLine(line);
        });
      }
    } catch (e: any) {
      this.serialReason =
        e?.message ||
        "serialport package failed to load. Optionally: npm install serialport @serialport/parser-readline";
    }
  }
}

export const acquisitionManager = new AcquisitionManager();
