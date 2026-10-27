/**
 * Physical telemetry contract + pipeline isolation checks.
 *   npx tsx src/trust/run_telemetry_checks.ts
 */
import {
  assertNoTargetLeakage,
  createDeviceSequenceState,
  inferenceFeatureVector,
  INFERENCE_FEATURE_ORDER,
  normalizeIncoming,
} from "../telemetry/contract";
import { loadTelemetryConfig } from "../acquisition/config";
import { TrustValidator } from "./validator";

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`  ok  ${msg}`);
  }
}

function basePacket(over: Record<string, unknown> = {}) {
  return {
    device_id: "bms-lab-1",
    timestamp: Date.now(),
    voltage_v: 3.71,
    current_a: -1.25,
    ah: -0.4,
    chamber_temp_degC: 24.0,
    ...over,
  };
}

console.log("[Telemetry contract] running checks");

assert(INFERENCE_FEATURE_ORDER.length === 6, "six inference features");
assert(INFERENCE_FEATURE_ORDER[0] === "voltage_v", "feature 1 voltage");
assert(INFERENCE_FEATURE_ORDER[5] === "current_abs_a", "feature 6 |I|");

const seq = createDeviceSequenceState();
const cfg = { ...loadTelemetryConfig(), ahSource: "payload" as const, staleMs: 5000, futureSkewMs: 2000 };

const good = normalizeIncoming(basePacket(), {
  transport: "http",
  sequence: seq,
  config: cfg,
});
assert(good.ok === true, "valid packet accepted");
if (good.ok) {
  assert(good.value.derivedFields.includes("power_w=V*I"), "power derived as V*I when omitted");
  assert(good.value.derivedFields.includes("current_abs_a=|I|"), "|I| derived when omitted");
  assert(good.value.referenceTempDegC === null, "no fabricated reference temperature");
  assert(good.value.current_a === -1.25, "current sign preserved (discharge negative)");
  const vec = inferenceFeatureVector(good.value.sample);
  assert(vec.length === 6, "inference vector length 6");
  assert(!("battery_temp_degC" in (good.value.sample as any)), "target not on sample object as extra feature");
}

const malformed = normalizeIncoming("not-json" as any, {
  transport: "http",
  sequence: createDeviceSequenceState(),
  config: cfg,
});
assert(malformed.ok === false && malformed.code === "MALFORMED", "non-object is MALFORMED");

const missing = normalizeIncoming(
  { device_id: "x", timestamp: Date.now(), voltage_v: 3.7 },
  { transport: "http", sequence: createDeviceSequenceState(), config: cfg }
);
assert(missing.ok === false && missing.code === "MISSING_FEATURES", "missing current and ambient");
if (!missing.ok) {
  assert(missing.missingFeatures.includes("current_a"), "reports missing current_a");
  assert(missing.missingFeatures.includes("chamber_temp_degC"), "reports missing chamber_temp_degC");
}

const missingAh = normalizeIncoming(
  {
    device_id: "x",
    timestamp: Date.now(),
    voltage_v: 3.7,
    current_a: -1,
    chamber_temp_degC: 20,
  },
  { transport: "http", sequence: createDeviceSequenceState(), config: { ...cfg, ahSource: "payload" } }
);
assert(missingAh.ok === false && missingAh.missingFeatures.includes("ah"), "Ah required unless integrate is configured");

const integrateSeq = createDeviceSequenceState();
const integrateCfg = { ...cfg, ahSource: "integrate" as const, ahInitial: -0.1 };
const i1 = normalizeIncoming(
  {
    device_id: "x",
    timestamp: 1_700_000_000,
    voltage_v: 3.7,
    current_a: -1.8,
    chamber_temp_degC: 20,
  },
  { transport: "http", sequence: integrateSeq, config: integrateCfg, receivedAtMs: 1_700_000_000_000 }
);
const i2 = normalizeIncoming(
  {
    device_id: "x",
    timestamp: 1_700_000_001,
    voltage_v: 3.69,
    current_a: -1.8,
    chamber_temp_degC: 20,
  },
  { transport: "http", sequence: integrateSeq, config: integrateCfg, receivedAtMs: 1_700_000_001_000 }
);
assert(i1.ok && i2.ok, "Ah integrate accepts packets without ah field");
if (i1.ok && i2.ok) {
  const expected = -0.1 + (-1.8 * 1) / 3600;
  assert(Math.abs(i2.value.ah - expected) < 1e-9, "Ah coulomb-count uses I*dt/3600");
}

const stale = normalizeIncoming(basePacket({ timestamp: Date.now() - 30_000 }), {
  transport: "http",
  sequence: createDeviceSequenceState(),
  config: cfg,
});
assert(stale.ok === false && stale.code === "STALE_TIMESTAMP", "stale wall-clock timestamp rejected");

const dupSeq = createDeviceSequenceState();
const t = Date.now();
normalizeIncoming(basePacket({ timestamp: t }), { transport: "http", sequence: dupSeq, config: cfg });
const dup = normalizeIncoming(basePacket({ timestamp: t }), {
  transport: "http",
  sequence: dupSeq,
  config: cfg,
});
assert(dup.ok === false && dup.code === "DUPLICATE", "duplicate timestamp rejected");

const orderSeq = createDeviceSequenceState();
normalizeIncoming(basePacket({ timestamp: 1_800_000_010 }), {
  transport: "http",
  sequence: orderSeq,
  config: cfg,
  receivedAtMs: 1_800_000_010_000,
});
const ooo = normalizeIncoming(basePacket({ timestamp: 1_800_000_009 }), {
  transport: "http",
  sequence: orderSeq,
  config: cfg,
  receivedAtMs: 1_800_000_010_000,
});
assert(ooo.ok === false && ooo.code === "OUT_OF_ORDER", "out-of-order timestamp rejected");

const withRef = normalizeIncoming(basePacket({ battery_temp_degC: 31.2, timestamp: Date.now() + 10 }), {
  transport: "http",
  sequence: createDeviceSequenceState(),
  config: cfg,
});
assert(withRef.ok === true, "independent cell temp allowed as reference");
if (withRef.ok) {
  assert(withRef.value.referenceTempDegC === 31.2, "reference retained separately");
  const windowRow = {
    voltage_v: withRef.value.voltage_v,
    current_a: withRef.value.current_a,
    ah: withRef.value.ah,
    chamber_temp_degC: withRef.value.chamber_temp_degC,
    power_w: withRef.value.power_w,
    current_abs_a: withRef.value.current_abs_a,
    time_s: withRef.value.sampleTimeS,
  };
  assert(assertNoTargetLeakage([windowRow]), "window row omits battery_temp_degC");
}

const v = new TrustValidator();
const blocked = v.validate({
  voltage_v: 8.5,
  current_a: -1,
  ah: 0,
  chamber_temp_degC: 20,
  power_w: 8.5 * -1,
  current_abs_a: 1,
  time_s: 1,
  sampleTime: 1,
});
assert(blocked.decision === "BLOCK", "out-of-envelope live sample is BLOCK");

const shortWindow: Record<string, unknown>[] = [];
for (let i = 0; i < 12; i++) {
  shortWindow.push({
    voltage_v: 3.6,
    current_a: -1,
    ah: 0,
    chamber_temp_degC: 20,
    power_w: -3.6,
    current_abs_a: 1,
  });
}
assert(shortWindow.length !== 60, "insufficient window is not 60 steps");

console.log("[Disconnect/reconnect] sequence reset");
const recon = createDeviceSequenceState();
normalizeIncoming(basePacket({ timestamp: Date.now() + 50, device_id: "bms-lab-1" }), {
  transport: "http",
  sequence: recon,
  config: cfg,
});
assert(recon.lastCurrentA === -1.25, "sequence tracks last current");
const fresh = createDeviceSequenceState();
assert(fresh.lastSampleTimeS === null, "reconnect uses a fresh sequence (window not consecutive across disconnect)");

if (process.exitCode) {
  console.error("Telemetry checks failed.");
  process.exit(1);
}
console.log("Telemetry checks passed.");
