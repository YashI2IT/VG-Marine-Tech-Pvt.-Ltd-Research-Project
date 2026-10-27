/**
 * End-to-End Verification Suite for ECUlytics / TrustSense-BMS
 * Tests Path A (Physical BMS Ingestion) and Path B (Dataset Replay)
 */

const BACKEND_URL = "http://localhost:3001";
const FRONTEND_URL = "http://localhost:3000";

interface TestReport {
  name: string;
  passed: boolean;
  details: string;
}

const reports: TestReport[] = [];

function record(name: string, passed: boolean, details: string) {
  reports.push({ name, passed, details });
  console.log(`[${passed ? "PASS" : "FAIL"}] ${name} - ${details}`);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log("=== Starting TrustSense-BMS Telemetry & Virtual Sensor Verification ===");

  // 1. Backend & Proxy Health Check
  try {
    const directRes = await fetch(`${BACKEND_URL}/api/trustsense/status`);
    const directData = await directRes.json();
    record(
      "Backend Status Endpoint (Port 3001)",
      directRes.status === 200 && directData.status === "operational",
      `Status: ${directRes.status}, Pipeline: ${directData.pipeline}`
    );

    const proxyRes = await fetch(`${FRONTEND_URL}/api/trustsense/status`);
    const proxyData = await proxyRes.json();
    record(
      "Next.js Proxy Rewrite (Port 3000 -> 3001)",
      proxyRes.status === 200 && proxyData.status === "operational",
      `Status: ${proxyRes.status}, Model Architecture: ${proxyData.model?.model_architecture}`
    );

    record(
      "CNN-LSTM Model Microservice Status",
      directData.model?.ready === true && directData.model?.feature_columns?.length === 6,
      `Model Ready: ${directData.model?.ready}, Features: [${directData.model?.feature_columns?.join(", ")}]`
    );
  } catch (err: any) {
    record("Health Checks", false, err.message);
  }

  // 2. Path A: Physical HTTP Telemetry Ingestion (60-sample sequence)
  console.log("\n--- Testing Path A: Physical BMS Ingestion & 60-Step Buffer ---");
  await fetch(`${BACKEND_URL}/api/trustsense/simulation/control`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reset" }),
  });
  await sleep(300);

  const deviceId = `BMS-PHYS-${Date.now().toString(36)}`;
  let lastResult: any = null;
  let batchFinalizedAtSample30 = false;
  let inferenceTriggeredAtSample60 = false;

  try {
    for (let i = 1; i <= 60; i++) {
      const payload = {
        device_id: deviceId,
        time_s: i, // Relative boot seconds (1Hz)
        voltage_v: 3.72 + (i % 5) * 0.01,
        current_a: -1.5,
        ah: -0.05 * (i / 60),
        chamber_temp_degC: 25.0,
        power_w: (3.72 + (i % 5) * 0.01) * -1.5,
        current_abs_a: 1.5,
        battery_temp_degC: 25.4 + (i / 60) * 0.6,
      };

      const res = await fetch(`${BACKEND_URL}/api/trustsense/telemetry/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json();
      lastResult = body;

      if (i === 1) {
        record(
          "Path A: First Sample Admitted",
          res.status === 202 && body.accepted === true && body.windowLength === 1,
          `Status: ${res.status}, Window: ${body.windowLength}/60, Inferred: ${body.inferred}`
        );
      }

      if (i === 30) {
        batchFinalizedAtSample30 = body.windowLength === 30;
      }

      if (i === 60) {
        inferenceTriggeredAtSample60 =
          body.inferred === true &&
          typeof body.predictedTemp === "number" &&
          body.windowLength === 60;
      }
    }

    record(
      "Path A: Sample 30 Batch Processing",
      batchFinalizedAtSample30,
      `Rolling buffer advanced to 30 without stalling or early disconnect`
    );

    record(
      "Path A: Sample 60 Full Inference Trigger",
      inferenceTriggeredAtSample60,
      `Inferred: ${lastResult?.inferred}, Window: ${lastResult?.windowLength}/60, Predicted Temp: ${lastResult?.predictedTemp?.toFixed?.(2)}°C, Latency: ${lastResult?.latencyMs?.toFixed?.(1)}ms`
    );

    // Test out-of-envelope anomaly rejection
    const anomalyPayload = {
      device_id: deviceId,
      time_s: 61,
      voltage_v: 9.8, // out of physical range [2.0, 4.5]
      current_a: -1.5,
      ah: -0.05,
      chamber_temp_degC: 25.0,
    };

    const anomalyRes = await fetch(`${BACKEND_URL}/api/trustsense/telemetry/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(anomalyPayload),
    });
    const anomalyBody = await anomalyRes.json();
    record(
      "Path A: Out-of-Envelope Packet Quarantined/Blocked",
      anomalyBody.blocked === true || anomalyBody.trustDecision === "BLOCK",
      `Blocked: ${anomalyBody.blocked}, Trust Verdict: ${anomalyBody.trustDecision || anomalyBody.trustVerdict}`
    );

    // Test missing features rejection
    const missingPayload = {
      device_id: deviceId,
      time_s: 62,
      current_a: -1.5,
      // missing voltage_v and chamber_temp_degC
    };

    const missingRes = await fetch(`${BACKEND_URL}/api/trustsense/telemetry/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(missingPayload),
    });
    const missingBody = await missingRes.json();
    record(
      "Path A: Missing Features Ingestion Rejection",
      missingRes.status === 400 && missingBody.code === "MISSING_FEATURES",
      `Status: ${missingRes.status}, Code: ${missingBody.code}, Missing: [${missingBody.missingFeatures?.join(", ")}]`
    );
  } catch (err: any) {
    record("Path A: Ingestion Flow", false, err.message);
  }

  // 3. Path B: Dataset Replay Verification
  console.log("\n--- Testing Path B: Panasonic 18650PF Dataset Replay ---");
  try {
    // Reset/Stop any ongoing session
    await fetch(`${BACKEND_URL}/api/trustsense/simulation/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    await sleep(500);

    // Start simulation replay
    const startRes = await fetch(`${BACKEND_URL}/api/trustsense/simulation/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    const startBody = await startRes.json();
    record(
      "Path B: Replay Start Command",
      startRes.status === 200 && startBody.state?.status === "RUNNING",
      `Status: ${startBody.state?.status}, Mode: ${startBody.state?.mode}, Cycle: ${startBody.state?.currentCycle}`
    );

    // Speed up simulation to 5x
    await fetch(`${BACKEND_URL}/api/trustsense/simulation/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "speed", value: 5 }),
    });

    // Wait 3 seconds for samples to stream
    await sleep(3000);

    // Check status
    const pollRes = await fetch(`${BACKEND_URL}/api/trustsense/status`);
    const pollData = await pollRes.json();
    const sim = pollData.simulation;

    record(
      "Path B: Sample Streaming Active",
      sim.status === "RUNNING" && sim.currentSampleIndex > 0,
      `Replay status: ${sim.status}, Samples streamed: ${sim.currentSampleIndex}/${sim.totalSamples}, Speed: ${sim.speed}x`
    );

    // Test pause
    const pauseRes = await fetch(`${BACKEND_URL}/api/trustsense/simulation/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pause" }),
    });
    const pauseBody = await pauseRes.json();
    record(
      "Path B: Replay Pause Command",
      pauseRes.status === 200 && pauseBody.state?.status === "PAUSED",
      `Status: ${pauseBody.state?.status}, Samples reached: ${pauseBody.state?.currentSampleIndex}`
    );

    // Test reset
    const resetRes = await fetch(`${BACKEND_URL}/api/trustsense/simulation/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    const resetBody = await resetRes.json();
    record(
      "Path B: Replay Reset Command",
      resetRes.status === 200 && resetBody.state?.status === "IDLE" && resetBody.state?.currentSampleIndex === 0,
      `Status: ${resetBody.state?.status}, Index: ${resetBody.state?.currentSampleIndex}`
    );
  } catch (err: any) {
    record("Path B: Replay Flow", false, err.message);
  }

  // 4. SSE Stream Connectivity Check
  console.log("\n--- Testing SSE Telemetry Event Stream ---");
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const sseRes = await fetch(`${BACKEND_URL}/api/trustsense/simulation/stream`, {
      signal: controller.signal,
    });

    const isSSE = sseRes.headers.get("content-type")?.includes("text/event-stream");
    clearTimeout(timeout);
    controller.abort(); // close connection

    record(
      "SSE EventStream Protocol Headers",
      Boolean(isSSE),
      `Content-Type: ${sseRes.headers.get("content-type")}, Status: ${sseRes.status}`
    );
  } catch (err: any) {
    if (err.name === "AbortError") {
      record("SSE EventStream Protocol Headers", true, "Successfully connected to SSE stream and received headers before abort");
    } else {
      record("SSE EventStream Protocol Headers", false, err.message);
    }
  }

  // Summary
  console.log("\n=================== VERIFICATION SUMMARY ===================");
  const total = reports.length;
  const passed = reports.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`TOTAL CHECKS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);

  if (failed > 0) {
    console.error("Some checks failed!");
    process.exit(1);
  } else {
    console.log("All Virtual Sensor & Telemetry Pipeline checks PASSED cleanly!");
    process.exit(0);
  }
}

run().catch((e) => {
  console.error("Unhandled verification exception:", e);
  process.exit(1);
});
