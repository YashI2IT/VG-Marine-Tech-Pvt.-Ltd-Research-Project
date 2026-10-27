/**
 * Direct TrustValidator checks (no Jest). Run:
 *   npx tsx src/trust/run_validator_checks.ts
 * from Development/backend.
 */
import { TrustValidator, TelemetrySample } from "./validator";

function sample(overrides: Partial<TelemetrySample> = {}): TelemetrySample {
  return {
    voltage_v: 3.65,
    current_a: -1.2,
    ah: -0.4,
    chamber_temp_degC: 10,
    power_w: 3.65 * -1.2,
    current_abs_a: 1.2,
    time_s: 1,
    sampleTime: 1,
    recordIndex: 1,
    ...overrides,
  };
}

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`  ok  ${msg}`);
  }
}

const v = new TrustValidator();

console.log("[TrustValidator] running checks");

const safe = v.validate(sample());
assert(safe.decision === "SAFE", "nominal Panasonic sample is SAFE");

const overVoltage = v.validate(sample({ voltage_v: 8.5, power_w: 8.5 * -1.2, time_s: 2, sampleTime: 2 }));
assert(overVoltage.decision === "BLOCK", "8.5 V is BLOCK");
assert(
  overVoltage.violations.some((x) => x.startsWith("VOLTAGE_OUT_OF_BOUNDS")),
  "voltage bound violation is logged"
);

const powerMismatch = v.validate(
  sample({ power_w: -99, time_s: 3, sampleTime: 3 })
);
assert(powerMismatch.decision === "BLOCK", "P vs V*I mismatch is BLOCK");

v.reset();
v.validate(sample({ time_s: 10, sampleTime: 10, voltage_v: 2.6, power_w: 2.6 * -1.2 }));
const spikeInBand = v.validate(
  sample({
    time_s: 11,
    sampleTime: 11,
    voltage_v: 4.2,
    current_a: -1.2,
    power_w: 4.2 * -1.2,
    current_abs_a: 1.2,
  })
);
assert(spikeInBand.decision === "BLOCK", "in-band dV/dt spike is BLOCK, not SUSPICIOUS");
assert(
  spikeInBand.violations.some((x) => x.startsWith("RAPID_VOLTAGE_SPIKE")),
  "dV/dt violation is logged"
);

v.reset();
v.validate(sample({ time_s: 20, sampleTime: 20 }));
const blocked = v.validate(sample({ time_s: 21, sampleTime: 21, voltage_v: 8.5, power_w: 8.5 * -1.2 }));
assert(blocked.decision === "BLOCK", "blocked sample still BLOCK");
const recovered = v.validate(
  sample({
    time_s: 22,
    sampleTime: 22,
    voltage_v: 3.61,
    current_a: -1.2,
    power_w: 3.61 * -1.2,
    current_abs_a: 1.2,
  })
);
assert(
  recovered.decision === "SAFE",
  "sample after quarantined spike is not judged against the blocked voltage"
);

if (process.exitCode) {
  console.error("TrustValidator checks failed.");
  process.exit(1);
}
console.log("TrustValidator checks passed.");
