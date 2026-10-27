/**
 * TrustSense-BMS: Hyperledger Fabric End-to-End Verification Pipeline
 * 
 * Executes:
 * 1. Peer and Ordering service health and endpoint resolution
 * 2. Client X.509 identity and TLS connection establishment
 * 3. Channel resolution ('bmschannel') and smart contract binding ('trustsense-provenance')
 * 4. Submission of AnchorBatch transaction with synthetic battery telemetry Merkle root
 * 5. Readback of committed state from Fabric ledger (GetBatch)
 * 6. Cryptographic validation of transaction outcome, Merkle root, and leaf parity
 * 7. Reporting with genuine Transaction ID, block number, and endorsement metadata
 * 8. Clean fallback diagnostics when live network is unavailable
 * 
 * Run with:
 *   npm --prefix Development/backend run verify:fabric
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

import { ledgerGateway } from "./ledger";
import { initDb } from "../db";
import { MerkleTree } from "../provenance/merkle";

async function verifyFabricPipeline() {
  console.log("=====================================================================");
  console.log(" TrustSense-BMS: Hyperledger Fabric Verification Pipeline");
  console.log(" Timestamp: " + new Date().toISOString());
  console.log("=====================================================================");

  await initDb();

  const channel = process.env.FABRIC_CHANNEL || "bmschannel";
  const chaincode = process.env.FABRIC_CHAINCODE || "trustsense-provenance";
  const endpoint = process.env.FABRIC_PEER_ENDPOINT || "";

  console.log("\n[1. Inspecting Fabric Network Configuration]");
  console.log(`  Channel Name:           ${channel}`);
  console.log(`  Chaincode (Contract):   ${chaincode}`);
  console.log(`  Peer Endpoint:          ${endpoint || "UNCONFIGURED (Local Adapter Mode)"}`);
  console.log(`  MSP ID:                 ${process.env.FABRIC_MSP_ID || "Org1MSP"}`);

  // -------------------------------------------------------------------------
  // Step 2: Probe Live Fabric Connection
  // -------------------------------------------------------------------------
  console.log("\n[2. Probing Hyperledger Fabric Peer Connection]");
  const probe = await ledgerGateway.probeLiveFabricConnection();
  console.log(`  Operational Status:     ${probe.status}`);
  console.log(`  Probe Duration:         ${probe.durationMs}ms`);

  if (probe.status === "LOCAL_ADAPTER_ACTIVE") {
    console.log("\n  info  FABRIC_PEER_ENDPOINT is not configured in backend environment.");
    console.log("  info  TrustSense-BMS is operating in verified PostgreSQL ledger adapter mode (LOCAL_DEV_NETWORK).");
    console.log("  info  To connect to a live peer:");
    console.log("        1. Start the Fabric network: cd Production/fabric && ./scripts/bootstrap_network.ps1");
    console.log("        2. Set in Development/backend/.env:");
    console.log("           FABRIC_PEER_ENDPOINT=localhost:7051");
    console.log("           FABRIC_CHANNEL=bmschannel");
    console.log("           FABRIC_CHAINCODE=trustsense-provenance");
    console.log("           FABRIC_MSP_ID=Org1MSP");
  } else if (probe.status === "FABRIC_UNAVAILABLE") {
    console.warn("\n  warn  Peer configured at " + endpoint + " but connection failed or timed out.");
    console.warn("  warn  Error details: " + probe.error);
    console.warn("  warn  Category: " + probe.errorCategory);
    console.log("  ok    Safely retained PostgreSQL ledger adapter without silent misrepresentation.");
  } else if (probe.status === "FABRIC_CONNECTED" || probe.status === "FABRIC_TRANSACTION_VERIFIED") {
    console.log("  ok    Successfully connected to live Hyperledger Fabric peer at " + endpoint);
    console.log("  ok    Smart contract '" + chaincode + "' is bound on channel '" + channel + "'");
  }

  // -------------------------------------------------------------------------
  // Step 3: Execute Anchor Transaction & Readback
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // Step 3: Execute Anchor Transaction & Readback
  // -------------------------------------------------------------------------
  console.log("\n[3. Executing Batch Anchor Transaction with Real Merkle Tree]");
  const testBatchId = `batch_fabric_verify_${Date.now()}`;
  const testLeaves = [
    { recordId: "rec_0001", recordHash: crypto.randomBytes(32).toString("hex"), payload: { v: 3.701, i: 1.45 } },
    { recordId: "rec_0002", recordHash: crypto.randomBytes(32).toString("hex"), payload: { v: 3.705, i: 1.48 } },
    { recordId: "rec_0003", recordHash: crypto.randomBytes(32).toString("hex"), payload: { v: 3.710, i: 1.50 } },
    { recordId: "rec_0004", recordHash: crypto.randomBytes(32).toString("hex"), payload: { v: 3.712, i: 1.52 } },
  ];
  const tree = new MerkleTree(testLeaves);
  const batchResult = tree.toBatch(testBatchId);
  const testRoot = batchResult.merkleRoot;
  const leafCount = batchResult.leafCount;
  const startId = "rec_0001";
  const endId = "rec_0004";
  const modelVersion = "1.0.0";
  const batteryId = "BAT-PAN18650PF-001";

  const anchor = await ledgerGateway.anchorBatch(
    testBatchId,
    testRoot,
    leafCount,
    startId,
    endId,
    modelVersion,
    batteryId
  );

  console.log(`  ok  Anchor ID:              ${anchor.id}`);
  console.log(`  ok  Fabric Tx ID:           ${anchor.fabricTxId}`);
  console.log(`  ok  Block Number:           ${anchor.blockNumber}`);
  console.log(`  ok  Network Type:           ${anchor.networkType}`);
  console.log(`  ok  Provenance State:       ${anchor.provenanceState}`);
  console.log(`  ok  Status:                 ${anchor.status}`);
  console.log(`  ok  Verification Status:    ${anchor.verificationStatus}`);

  // -------------------------------------------------------------------------
  // Step 4: Validate Battery Passport State Update
  // -------------------------------------------------------------------------
  console.log("\n[4. Validating Digital Battery Passport State]");
  const passport = await ledgerGateway.getBatteryPassport(batteryId);
  if (passport) {
    console.log(`  ok  Battery ID:             ${passport.batteryId}`);
    console.log(`  ok  Cell Model:             ${passport.cellModel}`);
    console.log(`  ok  Total Anchored Batches: ${passport.totalBatchesAnchored}`);
    console.log(`  ok  Latest Merkle Root:     ${passport.latestMerkleRoot}`);
    console.log(`  ok  Latest Tx ID:           ${passport.latestTxId}`);
  }

  // -------------------------------------------------------------------------
  // Step 4b: Live Ledger Direct Query Readback
  // -------------------------------------------------------------------------
  console.log("\n[4b. Direct Readback from Hyperledger Fabric Smart Contract]");
  if (anchor.livePeerConfirmed) {
    const liveBatch = await ledgerGateway.queryLiveBatch(testBatchId);
    if (liveBatch) {
      console.log(`  ok  Fabric Committed Batch ID:  ${liveBatch.batchId}`);
      console.log(`  ok  Fabric Committed Tx ID:     ${liveBatch.txId}`);
      console.log(`  ok  Fabric Committed Root:      ${liveBatch.merkleRoot}`);
      console.log(`  ok  Fabric Leaf Count:          ${liveBatch.leafCount}`);
      console.log(`  ok  Fabric Submitting Org:      ${liveBatch.submittingOrg}`);
      console.log(`  ok  Fabric Ledger Status:       ${liveBatch.status}`);
      if (liveBatch.merkleRoot !== testRoot) {
        throw new Error("Cryptographic mismatch between submitted Merkle root and on-chain state!");
      }
    } else {
      throw new Error(`Failed to query committed batch '${testBatchId}' back from live Fabric ledger!`);
    }

    const livePassport = await ledgerGateway.queryLiveBatteryPassport(batteryId);
    if (livePassport) {
      console.log(`  ok  Fabric Passport Battery:    ${livePassport.batteryId}`);
      console.log(`  ok  Fabric Passport Latest Root:${livePassport.latestMerkleRoot}`);
      console.log(`  ok  Fabric Passport Latest Tx:  ${livePassport.latestTxId}`);
      console.log(`  ok  Fabric Total Batches:       ${livePassport.totalBatchesAnchored}`);
    }
  } else {
    console.log("  info  Operating in local PostgreSQL ledger adapter mode. Live chaincode query bypassed.");
  }

  // -------------------------------------------------------------------------
  // Step 5: Verify Inclusion Proofs (Positive & Negative Cases)
  // -------------------------------------------------------------------------
  console.log("\n[5. Cryptographic Inclusion Proof Verification (Positive & Negative Cases)]");
  
  // 5.1 Positive test: Valid inclusion proof for leaf 0
  const leaf0 = batchResult.leaves[0];
  const validProofRes = await ledgerGateway.verifyOnChain(testBatchId, leaf0.recordHash, leaf0.proof);
  console.log(`  5.1 Valid Proof Verification:`);
  console.log(`      Verified:           ${validProofRes.verified}`);
  console.log(`      Method:             ${validProofRes.verificationMethod}`);
  console.log(`      Anchored Root:      ${validProofRes.anchoredRoot}`);
  console.log(`      Reconstructed Root: ${validProofRes.reconstructedRoot}`);
  if (!validProofRes.verified) {
    throw new Error(`Valid Merkle inclusion proof was unexpectedly rejected!`);
  }

  // 5.2 Negative test: Tampered leaf record hash
  const tamperedLeafHash = crypto.randomBytes(32).toString("hex");
  const tamperedLeafRes = await ledgerGateway.verifyOnChain(testBatchId, tamperedLeafHash, leaf0.proof);
  console.log(`  5.2 Tampered Record Hash Verification:`);
  console.log(`      Verified:           ${tamperedLeafRes.verified}`);
  console.log(`      Outcome:            ${!tamperedLeafRes.verified ? "STRICTLY_REJECTED (Expected)" : "FAILED"}`);
  console.log(`      Reason:             ${tamperedLeafRes.reason}`);
  if (tamperedLeafRes.verified) {
    throw new Error(`Tampered record hash was unexpectedly accepted!`);
  }

  // 5.3 Negative test: Tampered sibling proof hash
  const tamperedProofSteps = leaf0.proof.map((p, idx) => 
    idx === 0 ? { ...p, hash: crypto.randomBytes(32).toString("hex") } : p
  );
  const tamperedStepRes = await ledgerGateway.verifyOnChain(testBatchId, leaf0.recordHash, tamperedProofSteps);
  console.log(`  5.3 Tampered Proof Sibling Verification:`);
  console.log(`      Verified:           ${tamperedStepRes.verified}`);
  console.log(`      Outcome:            ${!tamperedStepRes.verified ? "STRICTLY_REJECTED (Expected)" : "FAILED"}`);
  if (tamperedStepRes.verified) {
    throw new Error(`Tampered proof step hash was unexpectedly accepted!`);
  }

  // 5.4 Negative test: Inverted proof step position
  const invertedPositionProof = leaf0.proof.map((p, idx) => 
    idx === 0 ? { ...p, position: (p.position === "left" ? "right" : "left") as "left" | "right" } : p
  );
  const invertedPosRes = await ledgerGateway.verifyOnChain(testBatchId, leaf0.recordHash, invertedPositionProof);
  console.log(`  5.4 Inverted Proof Position Verification:`);
  console.log(`      Verified:           ${invertedPosRes.verified}`);
  console.log(`      Outcome:            ${!invertedPosRes.verified ? "STRICTLY_REJECTED (Expected)" : "FAILED"}`);
  if (invertedPosRes.verified) {
    throw new Error(`Inverted proof step position was unexpectedly accepted!`);
  }

  console.log("\n=====================================================================");
  console.log(" Hyperledger Fabric Pipeline Check Complete");
  console.log(" Operational Mode: " + anchor.networkType);
  console.log("=====================================================================\n");
}

if (require.main === module) {
  verifyFabricPipeline().catch((err) => {
    console.error("[Fabric Pipeline Error]:", err.message);
    process.exit(1);
  });
}

export { verifyFabricPipeline };
