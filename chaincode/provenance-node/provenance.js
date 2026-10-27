/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * TrustSense-BMS: Hyperledger Fabric Smart Contract (Chaincode)
 * Node.js Contract API implementation matching Go provenance.go
 */

'use strict';

const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');

class ProvenanceContract extends Contract {
  constructor() {
    super('trustsense-provenance');
  }

  /**
   * InitLedger initializes the ledger with genesis battery passport data
   */
  async InitLedger(ctx) {
    const passport = {
      docType: 'battery_passport',
      batteryId: 'BAT-PAN18650PF-001',
      cellModel: 'Panasonic NCR18650PF',
      chemistry: 'LiNiCoAlO2 (NCA)',
      nominalCapacityAh: 2.9,
      nominalVoltageV: 3.6,
      manufacturer: 'Panasonic Energy Co., Ltd.',
      manufactureDate: '2025-01-15T00:00:00.000Z',
      totalCycles: 142,
      totalBatchesAnchored: 0,
      latestMerkleRoot: 'GENESIS_ROOT',
      latestTxId: 'GENESIS_TX',
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    };

    await ctx.stub.putState(`PASSPORT_${passport.batteryId}`, Buffer.from(JSON.stringify(passport)));
    return JSON.stringify({ success: true, initialized: passport.batteryId });
  }

  /**
   * AnchorBatch commits a Merkle root to the immutable ledger
   */
  async AnchorBatch(
    ctx,
    batchId,
    merkleRoot,
    leafCountStr,
    startRecordId,
    endRecordId,
    modelVersion,
    batteryId = 'BAT-PAN18650PF-001'
  ) {
    const txId = ctx.stub.getTxID();
    const timestamp = ctx.stub.getTxTimestamp();
    const anchorTime = new Date(timestamp.seconds.low * 1000).toISOString();
    const leafCount = parseInt(leafCountStr, 10) || 0;

    let submittingOrg = 'Org1MSP';
    try {
      submittingOrg = ctx.clientIdentity.getMSPID();
    } catch (e) {
      // Default to Org1MSP in test double
    }

    const anchor = {
      docType: 'merkle_batch',
      batchId,
      merkleRoot,
      leafCount,
      startRecordId,
      endRecordId,
      modelVersion,
      anchorTimestamp: anchorTime,
      txId,
      submittingOrg,
      status: 'COMMITTED',
    };

    // Store batch state on ledger
    await ctx.stub.putState(`BATCH_${batchId}`, Buffer.from(JSON.stringify(anchor)));

    // Update battery passport if batteryId provided
    if (batteryId) {
      const passKey = `PASSPORT_${batteryId}`;
      const passBytes = await ctx.stub.getState(passKey);
      if (passBytes && passBytes.length > 0) {
        try {
          const pass = JSON.parse(passBytes.toString());
          pass.latestMerkleRoot = merkleRoot;
          pass.latestTxId = txId;
          pass.totalBatchesAnchored = (pass.totalBatchesAnchored || 0) + 1;
          pass.updatedAt = anchorTime;
          await ctx.stub.putState(passKey, Buffer.from(JSON.stringify(pass)));
        } catch (e) {
          // Continue if passport update encounters parse issue
        }
      }
    }

    return JSON.stringify(anchor);
  }

  /**
   * GetBatch retrieves an anchored batch by ID
   */
  async GetBatch(ctx, batchId) {
    const anchorBytes = await ctx.stub.getState(`BATCH_${batchId}`);
    if (!anchorBytes || anchorBytes.length === 0) {
      throw new Error(`Batch with ID '${batchId}' does not exist on ledger`);
    }
    return anchorBytes.toString();
  }

  /**
   * VerifyInclusionOnChain evaluates a Merkle inclusion proof directly on the ledger
   */
  async VerifyInclusionOnChain(ctx, batchId, recordHash, proofJson) {
    const anchorStr = await this.GetBatch(ctx, batchId);
    const anchor = JSON.parse(anchorStr);

    let proof = [];
    try {
      proof = JSON.parse(proofJson);
    } catch (e) {
      throw new Error(`Invalid proof JSON: ${e.message}`);
    }

    // RFC 6962 Domain-separated leaf hashing: SHA256(0x00 || recordHash)
    const recBuf = Buffer.from(recordHash, 'hex');
    const leafBuf = Buffer.concat([Buffer.from([0x00]), recBuf]);
    let currentHash = crypto.createHash('sha256').update(leafBuf).digest('hex');

    // Walk up tree with node prefix 0x01
    for (const step of proof) {
      const stepBuf = Buffer.from(step.hash, 'hex');
      const currBuf = Buffer.from(currentHash, 'hex');

      let nodeBuf;
      if (step.position === 'left') {
        nodeBuf = Buffer.concat([Buffer.from([0x01]), stepBuf, currBuf]);
      } else {
        nodeBuf = Buffer.concat([Buffer.from([0x01]), currBuf, stepBuf]);
      }

      currentHash = crypto.createHash('sha256').update(nodeBuf).digest('hex');
    }

    const matches = currentHash.toLowerCase() === anchor.merkleRoot.toLowerCase();
    return JSON.stringify({
      verified: matches,
      batchId,
      anchoredRoot: anchor.merkleRoot,
      reconstructedRoot: currentHash,
      txId: anchor.txId,
    });
  }

  /**
   * GetBatteryPassport retrieves the battery passport from ledger
   */
  async GetBatteryPassport(ctx, batteryId = 'BAT-PAN18650PF-001') {
    const passBytes = await ctx.stub.getState(`PASSPORT_${batteryId}`);
    if (!passBytes || passBytes.length === 0) {
      throw new Error(`Passport for battery '${batteryId}' not found on ledger`);
    }
    return passBytes.toString();
  }
}

module.exports = ProvenanceContract;
