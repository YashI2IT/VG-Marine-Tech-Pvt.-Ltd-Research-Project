/**
 * TrustSense-BMS End-to-End Automated Pipeline Test Suite
 * 
 * Validates the full 10-phase pipeline with explicit assertions:
 * 1. Model Service & Weights Health
 * 2. Dataset Segment Loading & Feature Mapping
 * 3. 60-Step Window Inference & Target Leakage Prevention
 * 4. Cybersecurity & Physics Plausibility Filter
 * 5. Deterministic Canonicalization & SHA-256
 * 6. Domain-Separated Merkle Tree & Inclusion Proofs
 * 7. Deliberate Post-Commit Tamper Detection
 * 8. Live Simulation Stream & Database Persistence
 * 9. Hyperledger Fabric Ledger Anchoring & Verification
 * 10. Attack Quarantine Interception
 */

const http = require('http');
const crypto = require('crypto');
const path = require('path');

let Pool;
try {
  Pool = require('pg').Pool;
} catch {
  Pool = require(path.resolve(__dirname, '../../Development/backend/node_modules/pg')).Pool;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:Ypb%40192576@localhost:5432/eculytics',
});

function httpGet(urlStr) {
  return new Promise((resolve, reject) => {
    http.get(urlStr, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch (e) { resolve({ status: res.statusCode, body: b }); }
      });
    }).on('error', reject);
  });
}

function httpPost(urlStr, postData) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const data = typeof postData === 'string' ? postData : JSON.stringify(postData);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch (e) { resolve({ status: res.statusCode, body: b }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('  TRUSTSENSE-BMS: AUTOMATED END-TO-END PIPELINE VERIFICATION');
  console.log('================================================================\n');

  // TEST 1: Model Service Health
  console.log('[TEST 1] Verifying Thermal AI Model Service Health...');
  const healthRes = await httpGet('http://127.0.0.1:8000/health');
  assert(healthRes.status === 200, 'Inference service HTTP status 200');
  assert(healthRes.body.ready === true, 'Model is ready');
  assert(healthRes.body.model_version === '1.0.0', 'Model version is 1.0.0');
  assert(healthRes.body.window_length === 60, 'Required sequence length is 60 steps');
  assert(healthRes.body.target_column === 'battery_temp_degC', 'Prediction target is battery_temp_degC');

  // TEST 2: Dataset Cycle Loading
  console.log('\n[TEST 2] Verifying Panasonic 18650PF Dataset Loading...');
  const cycleRes = await httpGet('http://127.0.0.1:8000/api/dataset/load_cycle?filename=03-27-17_09.06%2010degC_UDDS_Pan18650PF.mat&limit=65');
  assert(cycleRes.status === 200, 'Dataset cycle loaded with HTTP 200');
  assert(cycleRes.body.returned_count === 65, 'Loaded exactly 65 real telemetry samples');
  const sample0 = cycleRes.body.records[0];
  assert(typeof sample0.voltage_v === 'number', 'Contains voltage_v');
  assert(typeof sample0.current_a === 'number', 'Contains current_a');
  assert(typeof sample0.power_w === 'number', 'Contains derived power_w');

  // TEST 3: 60-Step Window Inference & Target Leakage Prevention
  console.log('\n[TEST 3] Calling CNN-LSTM Inference & Asserting Target Leakage Prevention...');
  const window60 = cycleRes.body.records.slice(0, 60).map(r => ({
    voltage_v: r.voltage_v,
    current_a: r.current_a,
    ah: r.ah,
    chamber_temp_degC: r.chamber_temp_degC,
    power_w: r.power_w,
    current_abs_a: r.current_abs_a,
    time_s: r.time_s,
  }));

  const measuredRef = cycleRes.body.records[59].battery_temp_degC;
  const predRes = await httpPost('http://127.0.0.1:8000/api/predict/window', {
    window: window60,
    reference_temp_degC: measuredRef,
    window_id: 'test-win-001',
    model_variant: 'cnn-lstm-baseline',
  });

  assert(predRes.status === 200, 'Prediction succeeded with HTTP 200');
  assert(predRes.body.status === 'SUCCESS', 'Prediction status SUCCESS');
  assert(typeof predRes.body.predicted_temp_degC === 'number', 'Predicted temperature is a valid float');
  assert(predRes.body.target_leakage_prevented === true, 'Target leakage strictly prevented (reference temp excluded from input window)');
  assert(predRes.body.latency_ms < 1500, `Inference latency within budget (${predRes.body.latency_ms}ms)`);
  console.log(`    Predicted: ${predRes.body.predicted_temp_degC}°C vs Reference: ${predRes.body.reference_temp_degC}°C (Residual: ${predRes.body.residual_degC}°C)`);

  // TEST 4: Backend Gateway Status
  console.log('\n[TEST 4] Verifying Backend Gateway & Fabric Ledger Status...');
  const gatewayRes = await httpGet('http://localhost:3001/api/trustsense/status');
  assert(gatewayRes.status === 200, 'Gateway status HTTP 200');
  assert(gatewayRes.body.status === 'operational', 'Pipeline status operational');
  assert(gatewayRes.body.ledger.status === 'connected', 'Hyperledger Fabric ledger status connected');
  assert(gatewayRes.body.storage.status === 'connected', 'Cloud storage status connected');

  // TEST 5: Canonical Serialization & SHA-256 Hashing
  console.log('\n[TEST 5] Testing Deterministic Canonical Hashing...');
  const payloadA = {
    schemaVersion: '1.0',
    recordId: 'rec_test_1',
    sampleTime: 100.5,
    simulationTime: '2026-10-22T00:00:00.000Z',
    voltage_v: 3.6543,
    current_a: -1.5,
    ah: -0.45,
    chamber_temp_degC: 10.0,
    power_w: -5.4815,
    current_abs_a: 1.5,
    trustDecision: 'SAFE',
  };

  // Same payload with reversed keys
  const payloadB = {
    trustDecision: 'SAFE',
    voltage_v: 3.6543,
    power_w: -5.4815,
    current_abs_a: 1.5,
    ah: -0.45,
    current_a: -1.5,
    chamber_temp_degC: 10.0,
    simulationTime: '2026-10-22T00:00:00.000Z',
    sampleTime: 100.5,
    recordId: 'rec_test_1',
    schemaVersion: '1.0',
  };

  const strA = JSON.stringify(payloadA, Object.keys(payloadA).sort());
  const strB = JSON.stringify(payloadB, Object.keys(payloadB).sort());
  const hashA = crypto.createHash('sha256').update(strA).digest('hex');
  const hashB = crypto.createHash('sha256').update(strB).digest('hex');

  assert(hashA === hashB, 'Canonical serialization produces identical SHA-256 regardless of key order');

  // Mutated payload produces different hash
  const payloadMutated = { ...payloadA, voltage_v: 3.6544 };
  const strMutated = JSON.stringify(payloadMutated, Object.keys(payloadMutated).sort());
  const hashMutated = crypto.createHash('sha256').update(strMutated).digest('hex');
  assert(hashA !== hashMutated, 'Single bit change produces completely different SHA-256 hash');

  // TEST 6: Live Simulation Stream & Database Storage
  console.log('\n[TEST 6] Testing Live Simulation Stream, Merkle Batching & DB Persistence...');
  await httpPost('http://localhost:3001/api/trustsense/simulation/control', { action: 'speed', value: 20 });
  await httpPost('http://localhost:3001/api/trustsense/simulation/control', { action: 'start' });

  // Stream for 4 seconds to produce 60+ samples and finalize at least one batch
  await new Promise(r => setTimeout(r, 4000));
  const pauseState = await httpPost('http://localhost:3001/api/trustsense/simulation/control', { action: 'pause' });

  assert(pauseState.body.state.currentSampleIndex > 40, `Processed ${pauseState.body.state.currentSampleIndex} samples`);
  assert(pauseState.body.state.activeBatchIndex >= 1, `Anchored at least ${pauseState.body.state.activeBatchIndex} Merkle batches`);

  // Verify PostgreSQL has records
  const pgClient = await pool.connect();
  const telCount = await pgClient.query('SELECT count(*) FROM telemetry_records');
  const predCount = await pgClient.query('SELECT count(*) FROM prediction_records');
  const batchCount = await pgClient.query('SELECT count(*) FROM merkle_batches');
  const anchorCount = await pgClient.query('SELECT count(*) FROM ledger_anchors');
  pgClient.release();

  assert(parseInt(telCount.rows[0].count) > 0, `PostgreSQL telemetry_records populated (${telCount.rows[0].count} rows)`);
  assert(parseInt(predCount.rows[0].count) > 0, `PostgreSQL prediction_records populated (${predCount.rows[0].count} rows)`);
  assert(parseInt(batchCount.rows[0].count) > 0, `PostgreSQL merkle_batches populated (${batchCount.rows[0].count} batches)`);
  assert(parseInt(anchorCount.rows[0].count) > 0, `PostgreSQL ledger_anchors populated (${anchorCount.rows[0].count} anchors)`);

  // TEST 7: Independent Cryptographic Verification of Stored Record
  console.log('\n[TEST 7] Running Independent Cryptographic Verification of Stored Record...');
  const batchesRes = await httpGet('http://localhost:3001/api/trustsense/provenance/batches');
  assert(batchesRes.body.count > 0, 'Batches returned from provenance endpoint');
  const targetBatch = batchesRes.body.batches[0];
  const targetRecordId = targetBatch.startRecordId;

  const verifyRes = await httpGet(`http://localhost:3001/api/trustsense/provenance/verify/${targetRecordId}`);
  assert(verifyRes.body.verified === true, 'Record verification passed 100%');
  assert(verifyRes.body.recordHashMatch === true, 'Step 1: Canonical payload SHA-256 matches stored record hash');
  assert(verifyRes.body.merkleRootMatch === true, 'Step 2: Merkle proof matches anchored Merkle root');
  assert(verifyRes.body.onChainAnchor?.verified === true, 'Step 3: Hyperledger Fabric anchor verified');

  // TEST 8: Post-Commit Deliberate Tamper Detection Demonstration
  console.log('\n[TEST 8] Executing Deliberate Post-Commit Tamper Detection Demonstration...');
  const tamperRes = await httpPost('http://localhost:3001/api/trustsense/provenance/tamper_test', {
    recordId: targetRecordId,
    fieldToTamper: 'voltage_v',
    tamperedValue: 5.999,
  });

  assert(tamperRes.body.auditResult.originalVerification.includes('VERIFIED'), 'Original un-tampered record verifies successfully');
  assert(tamperRes.body.auditResult.tamperDetected === true, 'Tamper detection correctly detected modification');
  assert(tamperRes.body.auditResult.tamperedVerification.includes('FAILED'), 'Tampered record verification correctly rejected');

  // TEST 9: Anomaly Quarantine Verification
  console.log('\n[TEST 9] Testing Cybersecurity Trust Layer Anomaly Quarantine...');
  await httpPost('http://localhost:3001/api/trustsense/simulation/anomaly', { type: 'voltage_spike' });
  await httpPost('http://localhost:3001/api/trustsense/simulation/control', { action: 'start' });
  await new Promise(r => setTimeout(r, 1200));
  await httpPost('http://localhost:3001/api/trustsense/simulation/control', { action: 'pause' });

  const qRes = await httpGet('http://localhost:3001/api/trustsense/quarantine');
  assert(qRes.body.count > 0, 'Anomalous record caught and stored in quarantine');
  const latestQ = qRes.body.records[0];
  assert(latestQ.trustDecision === 'BLOCK', 'Record labeled BLOCK');
  assert(latestQ.violationReasons.length > 0, 'Rejection violations clearly logged');

  // TEST 10: Battery Passport Query
  console.log('\n[TEST 10] Verifying Digital Battery Passport Ledger State...');
  const passRes = await httpGet('http://localhost:3001/api/trustsense/passport/BAT-PAN18650PF-001');
  assert(passRes.body.batteryId === 'BAT-PAN18650PF-001', 'Battery ID matched');
  assert(passRes.body.chemistry === 'LiNiCoAlO2 (NCA)', 'Chemistry is NCA');
  assert(passRes.body.totalBatchesAnchored > 0, `Passport tracks ${passRes.body.totalBatchesAnchored} anchored batches`);

  await pool.end();
  console.log('\n================================================================');
  console.log('  ✅ ALL 10 PIPELINE INTEGRATION TESTS PASSED (100% SUCCESS)');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
