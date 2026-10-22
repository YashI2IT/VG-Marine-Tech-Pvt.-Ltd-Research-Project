/**
 * TrustSense-BMS Cryptographic Provenance & Merkle Tree Engine
 * 
 * Complies with Phase 7 specifications:
 * - RFC 6962 Domain Separation:
 *   - Leaf hash: SHA256(0x00 || recordHash)
 *   - Internal node: SHA256(0x01 || leftChild || rightChild)
 * - Deterministic Canonical JSON Serialization
 * - Odd-leaf Handling: Duplicate last leaf
 * - Merkle Proof Generation & Independent Verification
 * - Tamper Detection Demonstration
 */

import crypto from "crypto";

export interface CanonicalTelemetryPayload {
  schemaVersion: string;
  recordId: string;
  sampleTime: number;
  simulationTime: string;
  voltage_v: number;
  current_a: number;
  ah: number;
  chamber_temp_degC: number;
  power_w: number;
  current_abs_a: number;
  trustDecision: string;
}

export interface MerkleProofStep {
  position: "left" | "right";
  hash: string;
}

export interface MerkleLeaf {
  recordId: string;
  recordHash: string;
  leafHash: string;
  index: number;
  proof: MerkleProofStep[];
}

export interface MerkleBatchResult {
  batchId: string;
  merkleRoot: string;
  leafCount: number;
  leaves: MerkleLeaf[];
  treeLevels: string[][];
  createdAt: string;
}

export interface VerificationResult {
  verified: boolean;
  recordId: string;
  calculatedRecordHash: string;
  storedRecordHash: string;
  recordHashMatch: boolean;
  reconstructedMerkleRoot: string;
  anchoredMerkleRoot: string;
  merkleRootMatch: boolean;
  tamperDetected: boolean;
  details: string[];
}

/**
 * Deterministically serialize a telemetry record.
 * Keys are alphabetically sorted and numbers are fixed to 4 decimal places.
 */
export function canonicalizeRecord(payload: CanonicalTelemetryPayload): string {
  const normalized = {
    ah: payload.ah.toFixed(4),
    chamber_temp_degC: payload.chamber_temp_degC.toFixed(4),
    current_a: payload.current_a.toFixed(4),
    current_abs_a: payload.current_abs_a.toFixed(4),
    power_w: payload.power_w.toFixed(4),
    recordId: payload.recordId,
    sampleTime: payload.sampleTime.toFixed(4),
    schemaVersion: payload.schemaVersion || "1.0",
    simulationTime: payload.simulationTime,
    trustDecision: payload.trustDecision,
    voltage_v: payload.voltage_v.toFixed(4),
  };

  return JSON.stringify(normalized, Object.keys(normalized).sort());
}

/**
 * Calculate SHA-256 hash of a canonical string.
 */
export function sha256(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Domain-separated leaf hashing: SHA256(0x00 || recordHash)
 */
export function hashLeaf(recordHash: string): string {
  const buf = Buffer.concat([Buffer.from([0x00]), Buffer.from(recordHash, "hex")]);
  return sha256(buf);
}

/**
 * Domain-separated node hashing: SHA256(0x01 || left || right)
 */
export function hashNode(left: string, right: string): string {
  const buf = Buffer.concat([
    Buffer.from([0x01]),
    Buffer.from(left, "hex"),
    Buffer.from(right, "hex"),
  ]);
  return sha256(buf);
}

export class MerkleTree {
  private leaves: { recordId: string; recordHash: string; leafHash: string }[] = [];
  private levels: string[][] = [];

  constructor(records: { recordId: string; recordHash: string }[]) {
    if (!records || records.length === 0) {
      throw new Error("Cannot create Merkle tree from empty records.");
    }

    this.leaves = records.map((r) => ({
      recordId: r.recordId,
      recordHash: r.recordHash,
      leafHash: hashLeaf(r.recordHash),
    }));

    this.buildTree();
  }

  private buildTree(): void {
    let currentLevel = this.leaves.map((l) => l.leafHash);
    this.levels = [currentLevel];

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        // Odd leaf handling: duplicate last leaf if odd count
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        nextLevel.push(hashNode(left, right));
      }

      this.levels.push(nextLevel);
      currentLevel = nextLevel;
    }
  }

  public getRoot(): string {
    return this.levels[this.levels.length - 1][0];
  }

  /**
   * Generate an audit-grade Merkle inclusion proof for a given leaf index.
   */
  public getProof(leafIndex: number): MerkleProofStep[] {
    if (leafIndex < 0 || leafIndex >= this.leaves.length) {
      throw new Error(`Invalid leaf index ${leafIndex}`);
    }

    const proof: MerkleProofStep[] = [];
    let idx = leafIndex;

    for (let level = 0; level < this.levels.length - 1; level++) {
      const currentLevel = this.levels[level];
      const isRight = idx % 2 === 1;
      const siblingIdx = isRight ? idx - 1 : idx + 1;

      if (siblingIdx < currentLevel.length) {
        proof.push({
          position: isRight ? "left" : "right",
          hash: currentLevel[siblingIdx],
        });
      } else {
        // Sibling was duplicate of current node
        proof.push({
          position: "right",
          hash: currentLevel[idx],
        });
      }

      idx = Math.floor(idx / 2);
    }

    return proof;
  }

  /**
   * Export the complete batch structure with roots and proofs for each leaf.
   */
  public toBatch(batchId: string): MerkleBatchResult {
    const leafResults: MerkleLeaf[] = this.leaves.map((l, idx) => ({
      recordId: l.recordId,
      recordHash: l.recordHash,
      leafHash: l.leafHash,
      index: idx,
      proof: this.getProof(idx),
    }));

    return {
      batchId,
      merkleRoot: this.getRoot(),
      leafCount: this.leaves.length,
      leaves: leafResults,
      treeLevels: this.levels,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Independent static verification of a Merkle proof against an expected root.
   */
  public static verifyProof(
    recordHash: string,
    proof: MerkleProofStep[],
    expectedRoot: string
  ): { valid: boolean; reconstructedRoot: string } {
    let currentHash = hashLeaf(recordHash);

    for (const step of proof) {
      if (step.position === "left") {
        currentHash = hashNode(step.hash, currentHash);
      } else {
        currentHash = hashNode(currentHash, step.hash);
      }
    }

    return {
      valid: currentHash.toLowerCase() === expectedRoot.toLowerCase(),
      reconstructedRoot: currentHash,
    };
  }

  /**
   * End-to-end full verification of a record against stored commitment.
   */
  public static verifyRecord(
    payload: CanonicalTelemetryPayload,
    storedRecordHash: string,
    proof: MerkleProofStep[],
    anchoredMerkleRoot: string
  ): VerificationResult {
    const details: string[] = [];
    const canonicalStr = canonicalizeRecord(payload);
    const calculatedRecordHash = sha256(canonicalStr);

    const recordHashMatch = calculatedRecordHash.toLowerCase() === storedRecordHash.toLowerCase();
    if (recordHashMatch) {
      details.push("✅ Step 1: Canonical payload SHA-256 matches stored record hash.");
    } else {
      details.push(`❌ Step 1 FAILED: Calculated hash ${calculatedRecordHash} differs from stored ${storedRecordHash}`);
    }

    const { valid: merkleMatch, reconstructedRoot } = MerkleTree.verifyProof(
      storedRecordHash,
      proof,
      anchoredMerkleRoot
    );

    if (merkleMatch) {
      details.push("✅ Step 2: Merkle branch inclusion proof successfully verified against anchored Merkle root.");
    } else {
      details.push(`❌ Step 2 FAILED: Reconstructed root ${reconstructedRoot} does not match anchored root ${anchoredMerkleRoot}`);
    }

    const verified = recordHashMatch && merkleMatch;
    const tamperDetected = !verified;

    if (verified) {
      details.push("✅ Step 3: Record provenance and cryptographic integrity 100% verified.");
    } else {
      details.push("⚠️ ALERT: Cryptographic verification FAILED. Data tampering or corruption detected!");
    }

    return {
      verified,
      recordId: payload.recordId,
      calculatedRecordHash,
      storedRecordHash,
      recordHashMatch,
      reconstructedMerkleRoot: reconstructedRoot,
      anchoredMerkleRoot,
      merkleRootMatch: merkleMatch,
      tamperDetected,
      details,
    };
  }
}
