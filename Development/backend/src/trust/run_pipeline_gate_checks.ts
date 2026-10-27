/**
 * BLOCK samples must never enter the 60-step inference buffer.
 * Uses a dummy DATABASE_URL so this can run without a live cluster.
 */
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgres://invalid:invalid@127.0.0.1:59999/none";
}

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`  ok  ${msg}`);
  }
}

async function main() {
  const { TelemetryPipeline } = await import("../pipeline/processor.js");
  const pipe = new TelemetryPipeline();
  pipe.beginSession("LIVE_DEVICE", "gate_test_session", "bms-lab-1");

  const safe = {
    voltage_v: 3.71,
    current_a: -1.25,
    ah: -0.4,
    chamber_temp_degC: 24,
    power_w: 3.71 * -1.25,
    current_abs_a: 1.25,
    time_s: 1,
    sampleTime: 1,
    recordIndex: 1,
  };

  const admitted = await pipe.processSample(safe, {
    source: "LIVE_DEVICE",
    deviceId: "bms-lab-1",
    referenceTemp: 31.2,
  });
  assert(admitted.accepted === true, "in-envelope live sample is admitted");
  assert(admitted.blocked === false, "admitted sample is not BLOCK");
  assert(admitted.windowLength === 1, "admitted sample enters the 60-step buffer");
  assert(admitted.inferred === false, "inference is not run before 60 consecutive samples");

  const spike = {
    ...safe,
    voltage_v: 8.5,
    power_w: 8.5 * -1.25,
    time_s: 2,
    sampleTime: 2,
    recordIndex: 2,
  };
  const blocked = await pipe.processSample(spike, {
    source: "LIVE_DEVICE",
    deviceId: "bms-lab-1",
    referenceTemp: null,
  });
  assert(blocked.blocked === true, "8.5 V live sample is BLOCK");
  assert(blocked.inferred === false, "BLOCK sample is not inferred");
  assert(blocked.windowLength === 1, "BLOCK sample does not grow the inference window");
  const windowVoltages = pipe.getWindowSnapshot().map((s: { voltage_v: number }) => s.voltage_v);
  assert(
    windowVoltages.every((v: number) => v !== 8.5),
    "blocked voltage never sits in the CNN-LSTM window"
  );

  if (process.exitCode) {
    console.error("Pipeline gate checks failed.");
    process.exit(1);
  }
  console.log("Pipeline gate checks passed.");
  process.exit(process.exitCode || 0);
}

main().catch((err) => {
  console.error("Fatal pipeline gate error:", err);
  process.exit(1);
});
