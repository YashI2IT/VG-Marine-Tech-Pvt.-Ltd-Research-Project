/**
 * Physical battery telemetry contract.
 *
 * Required measurements (never defaulted):
 *   voltage_v, current_a, chamber_temp_degC, device timestamp
 * Required for the CNN-LSTM window, derived only with an explicit method:
 *   power_w = V * I (electrical definition)
 *   current_abs_a = |I| (electrical definition)
 *   ah = payload value, or coulomb-count integrate if TELEMETRY_AH_SOURCE=integrate
 *
 * battery_temp_degC is optional reference only and is never an inference feature.
 * Current sign is preserved: negative = discharge (Panasonic 18650PF convention).
 */

import { TelemetrySample } from "../trust/validator";
import { loadTelemetryConfig, TelemetryRuntimeConfig } from "../acquisition/config";

export const INFERENCE_FEATURE_ORDER = [
  "voltage_v",
  "current_a",
  "ah",
  "chamber_temp_degC",
  "power_w",
  "current_abs_a",
] as const;

export type DataSourceType = "LIVE_DEVICE" | "DATASET_REPLAY";
export type TransportType = "http" | "mqtt" | "serial";

export interface IncomingTelemetryPacket {
  [key: string]: unknown;
}

export interface NormalizedTelemetry {
  deviceId: string;
  recordId: string | null;
  deviceTimestampMs: number;
  sampleTimeS: number;
  voltage_v: number;
  current_a: number;
  ah: number;
  chamber_temp_degC: number;
  power_w: number;
  current_abs_a: number;
  referenceTempDegC: number | null;
  transport: TransportType;
  dataSource: "LIVE_DEVICE";
  derivedFields: string[];
  sample: TelemetrySample;
}

export interface NormalizeFailure {
  ok: false;
  code:
    | "MALFORMED"
    | "MISSING_FEATURES"
    | "STALE_TIMESTAMP"
    | "DUPLICATE"
    | "OUT_OF_ORDER"
    | "INVALID_NUMERIC";
  missingFeatures: string[];
  reasons: string[];
}

export interface NormalizeSuccess {
  ok: true;
  value: NormalizedTelemetry;
}

export type NormalizeResult = NormalizeSuccess | NormalizeFailure;

export interface DeviceSequenceState {
  lastTimestampMs: number | null;
  lastSampleTimeS: number | null;
  lastCurrentA: number | null;
  accumulatedAh: number | null;
  seenTimestampKeys: Set<string>;
}

export function createDeviceSequenceState(): DeviceSequenceState {
  return {
    lastTimestampMs: null,
    lastSampleTimeS: null,
    lastCurrentA: null,
    accumulatedAh: null,
    seenTimestampKeys: new Set(),
  };
}

function firstNumber(obj: IncomingTelemetryPacket, keys: string[]): number | undefined {
  for (const key of keys) {
    if (obj[key] === undefined || obj[key] === null || obj[key] === "") continue;
    const n = typeof obj[key] === "number" ? obj[key] : Number(obj[key]);
    if (typeof n === "number" && Number.isFinite(n)) return n;
  }
  return undefined;
}

function firstString(obj: IncomingTelemetryPacket, keys: string[]): string | undefined {
  for (const key of keys) {
    if (typeof obj[key] === "string" && obj[key].trim()) return obj[key].trim();
  }
  return undefined;
}

export function parseDeviceTimestamp(raw: unknown, receivedAtMs: number): { ms: number; sampleTimeS: number } | { error: string } {
  if (raw === undefined || raw === null || raw === "") {
    return { error: "timestamp is required" };
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw >= 1e12) {
      return { ms: raw, sampleTimeS: raw / 1000 };
    }
    if (raw >= 1e9) {
      return { ms: raw * 1000, sampleTimeS: raw };
    }
    // Relative seconds from device boot — not a wall clock. Freshness uses receive time.
    return { ms: receivedAtMs, sampleTimeS: raw };
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    const asNum = Number(trimmed);
    if (trimmed !== "" && Number.isFinite(asNum) && !/^\d{4}-/.test(trimmed)) {
      return parseDeviceTimestamp(asNum, receivedAtMs);
    }
    const parsed = Date.parse(trimmed);
    if (Number.isNaN(parsed)) {
      return { error: `unparseable timestamp '${trimmed}'` };
    }
    return { ms: parsed, sampleTimeS: parsed / 1000 };
  }

  return { error: "timestamp must be epoch seconds/ms or ISO-8601" };
}

export function inferenceFeatureVector(sample: TelemetrySample): number[] {
  return [
    sample.voltage_v,
    sample.current_a,
    sample.ah,
    sample.chamber_temp_degC,
    sample.power_w,
    sample.current_abs_a,
  ];
}

export function assertNoTargetLeakage(windowRows: Array<Record<string, unknown>>): boolean {
  return windowRows.every(
    (row) => !("battery_temp_degC" in row) && !("temp_difference_degC" in row)
  );
}

export function normalizeIncoming(
  packet: IncomingTelemetryPacket,
  options: {
    transport: TransportType;
    receivedAtMs?: number;
    sequence: DeviceSequenceState;
    config?: TelemetryRuntimeConfig;
  }
): NormalizeResult {
  const cfg = options.config || loadTelemetryConfig();
  const receivedAtMs = options.receivedAtMs ?? Date.now();
  const reasons: string[] = [];
  const missing: string[] = [];
  const derived: string[] = [];

  if (!packet || typeof packet !== "object" || Array.isArray(packet)) {
    return {
      ok: false,
      code: "MALFORMED",
      missingFeatures: [],
      reasons: ["payload is not a JSON object"],
    };
  }

  const voltage = firstNumber(packet, ["voltage_v", "voltage", "pack_voltage_v", "V"]);
  const current = firstNumber(packet, ["current_a", "current", "pack_current_a", "I"]);
  const ambient = firstNumber(packet, [
    "chamber_temp_degC",
    "ambient_temp_degC",
    "ambient_c",
    "t_ambient",
    "temp_ambient",
  ]);
  const timestampRaw =
    packet.timestamp ??
    packet.device_timestamp ??
    packet.time_s ??
    packet.ts ??
    packet.sampleTime;

  if (voltage === undefined) missing.push("voltage_v");
  if (current === undefined) missing.push("current_a");
  if (ambient === undefined) missing.push("chamber_temp_degC");
  if (timestampRaw === undefined || timestampRaw === null || timestampRaw === "") {
    missing.push("timestamp");
  }

  if (missing.length > 0) {
    return {
      ok: false,
      code: "MISSING_FEATURES",
      missingFeatures: missing,
      reasons: [`Missing required measurements: ${missing.join(", ")}`],
    };
  }

  const ts = parseDeviceTimestamp(timestampRaw, receivedAtMs);
  if ("error" in ts) {
    return {
      ok: false,
      code: "MALFORMED",
      missingFeatures: ["timestamp"],
      reasons: [ts.error],
    };
  }

  const isRelativeSeconds = typeof timestampRaw === "number" && timestampRaw < 1e9;
  if (!isRelativeSeconds) {
    const ageMs = receivedAtMs - ts.ms;
    if (ageMs > cfg.staleMs) {
      return {
        ok: false,
        code: "STALE_TIMESTAMP",
        missingFeatures: [],
        reasons: [`Device timestamp is stale by ${ageMs} ms (limit ${cfg.staleMs} ms)`],
      };
    }
    if (ageMs < -cfg.futureSkewMs) {
      return {
        ok: false,
        code: "STALE_TIMESTAMP",
        missingFeatures: [],
        reasons: [`Device timestamp is ${-ageMs} ms in the future`],
      };
    }
  }

  const deviceId =
    firstString(packet, ["device_id", "deviceId", "bms_id", "gateway_id"]) || cfg.defaultDeviceId;
  const dupKey = `${deviceId}:${ts.sampleTimeS}`;
  if (options.sequence.seenTimestampKeys.has(dupKey)) {
    return {
      ok: false,
      code: "DUPLICATE",
      missingFeatures: [],
      reasons: [`Duplicate timestamp ${ts.sampleTimeS} for device ${deviceId}`],
    };
  }

  if (
    options.sequence.lastSampleTimeS !== null &&
    ts.sampleTimeS < options.sequence.lastSampleTimeS - 1e-9
  ) {
    return {
      ok: false,
      code: "OUT_OF_ORDER",
      missingFeatures: [],
      reasons: [
        `Out-of-order timestamp ${ts.sampleTimeS} after ${options.sequence.lastSampleTimeS}`,
      ],
    };
  }

  let power = firstNumber(packet, ["power_w", "power", "P"]);
  if (power === undefined) {
    power = voltage! * current!;
    derived.push("power_w=V*I");
  }

  let absI = firstNumber(packet, ["current_abs_a", "current_abs", "|I|"]);
  if (absI === undefined) {
    absI = Math.abs(current!);
    derived.push("current_abs_a=|I|");
  }

  let ah = firstNumber(packet, ["ah", "accumulated_ah", "ampere_hours"]);
  if (ah === undefined) {
    if (cfg.ahSource !== "integrate") {
      missing.push("ah");
      return {
        ok: false,
        code: "MISSING_FEATURES",
        missingFeatures: ["ah"],
        reasons: [
          "Accumulated Ah was not provided. Set TELEMETRY_AH_SOURCE=integrate and TELEMETRY_AH_INITIAL to coulomb-count from a configured initial Ah, or send ah in the packet.",
        ],
      };
    }
    if (options.sequence.accumulatedAh === null) {
      options.sequence.accumulatedAh = cfg.ahInitial;
    }
    if (options.sequence.lastSampleTimeS !== null && options.sequence.lastCurrentA !== null) {
      const dt = ts.sampleTimeS - options.sequence.lastSampleTimeS;
      if (dt <= 0) {
        return {
          ok: false,
          code: "OUT_OF_ORDER",
          missingFeatures: [],
          reasons: ["Cannot integrate Ah without a positive sampling interval"],
        };
      }
      options.sequence.accumulatedAh += (options.sequence.lastCurrentA * dt) / 3600;
    }
    ah = options.sequence.accumulatedAh;
    derived.push("ah=coulomb_count(I*dt/3600)");
  }

  const refTemp = firstNumber(packet, ["battery_temp_degC", "cell_temp_degC", "t_batt"]);
  const recordId = firstString(packet, ["record_id", "recordId", "id"]) || null;

  const sample: TelemetrySample = {
    voltage_v: voltage!,
    current_a: current!,
    ah: ah!,
    chamber_temp_degC: ambient!,
    power_w: power!,
    current_abs_a: absI!,
    time_s: ts.sampleTimeS,
    sampleTime: ts.sampleTimeS,
  };

  options.sequence.lastTimestampMs = ts.ms;
  options.sequence.lastSampleTimeS = ts.sampleTimeS;
  options.sequence.lastCurrentA = current!;
  options.sequence.accumulatedAh = ah!;
  options.sequence.seenTimestampKeys.add(dupKey);
  if (options.sequence.seenTimestampKeys.size > 4000) {
    const first = options.sequence.seenTimestampKeys.values().next().value;
    if (first) options.sequence.seenTimestampKeys.delete(first);
  }

  if (reasons.length) {
    /* reserved */
  }

  return {
    ok: true,
    value: {
      deviceId,
      recordId,
      deviceTimestampMs: ts.ms,
      sampleTimeS: ts.sampleTimeS,
      voltage_v: voltage!,
      current_a: current!,
      ah: ah!,
      chamber_temp_degC: ambient!,
      power_w: power!,
      current_abs_a: absI!,
      referenceTempDegC: refTemp !== undefined ? refTemp : null,
      transport: options.transport,
      dataSource: "LIVE_DEVICE",
      derivedFields: derived,
      sample,
    },
  };
}
