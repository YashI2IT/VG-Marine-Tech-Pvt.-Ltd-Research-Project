/**
 * Offline RFC 6962 Merkle + canonical SHA-256 checks (no Postgres, no Fabric).
 *   npx tsx src/trust/run_merkle_checks.ts
 */
import {
  CanonicalTelemetryPayload,
  MerkleTree,
  canonicalizeRecord,
  sha256,
} from "../provenance/merkle";

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`  ok  ${msg}`);
  }
}

function payload(over: Partial<CanonicalTelemetryPayload> = {}): CanonicalTelemetryPayload {
  return {
    schemaVersion: "1.0",
    recordId: "rec_1",
    sampleTime: 100.5,
    simulationTime: "2026-10-22T00:00:00.000Z",
    voltage_v: 3.6543,
    current_a: -1.5,
    ah: -0.45,
    chamber_temp_degC: 10,
    power_w: -5.48145,
    current_abs_a: 1.5,
    trustDecision: "SAFE",
    ...over,
  };
}

console.log("[Merkle] running checks");

try {
  new MerkleTree([]);
  assert(false, "empty tree should throw");
} catch (e: any) {
  assert(String(e.message).includes("empty"), "empty tree throws");
}

const a = payload();
const b = {
  trustDecision: a.trustDecision,
  voltage_v: a.voltage_v,
  power_w: a.power_w,
  current_abs_a: a.current_abs_a,
  ah: a.ah,
  current_a: a.current_a,
  chamber_temp_degC: a.chamber_temp_degC,
  simulationTime: a.simulationTime,
  sampleTime: a.sampleTime,
  recordId: a.recordId,
  schemaVersion: a.schemaVersion,
};
assert(
  canonicalizeRecord(a) === canonicalizeRecord(b as CanonicalTelemetryPayload),
  "canonical JSON is independent of object key order"
);
assert(sha256(canonicalizeRecord(a)).length === 64, "SHA-256 hex is 64 chars");
assert(
  sha256(canonicalizeRecord(a)) !== sha256(canonicalizeRecord(payload({ voltage_v: 3.6544 }))),
  "voltage change produces a different record hash"
);

const records = [1, 2, 3].map((i) => {
  const p = payload({ recordId: `rec_${i}`, sampleTime: 100 + i });
  return { recordId: p.recordId, recordHash: sha256(canonicalizeRecord(p)), payload: p };
});
const tree = new MerkleTree(records);
const batch = tree.toBatch("batch_odd");
assert(batch.leafCount === 3, "odd leaf count is accepted");
assert(batch.merkleRoot.length === 64, "root is a SHA-256 hex");

const leaf0 = batch.leaves[0];
const ok = MerkleTree.verifyRecord(
  records[0].payload,
  records[0].recordHash,
  leaf0.proof,
  batch.merkleRoot
);
assert(ok.verified === true, "untampered record verifies against root");
assert(ok.recordHashMatch === true, "stored hash matches canonical payload");
assert(ok.merkleRootMatch === true, "inclusion proof reconstructs the root");

const tampered = MerkleTree.verifyRecord(
  payload({ recordId: "rec_1", sampleTime: 101, voltage_v: 4.888 }),
  records[0].recordHash,
  leaf0.proof,
  batch.merkleRoot
);
assert(tampered.verified === false, "tampered payload fails verification");
assert(tampered.tamperDetected === true, "tamperDetected is true");
assert(tampered.recordHashMatch === false, "hash mismatch is caught at step 1");

const wrongProof = MerkleTree.verifyProof("00".repeat(32), leaf0.proof, batch.merkleRoot);
assert(wrongProof.valid === false, "random record hash does not verify against the root");

if (process.exitCode) {
  console.error("Merkle checks failed.");
  process.exit(1);
}
console.log("Merkle checks passed.");
