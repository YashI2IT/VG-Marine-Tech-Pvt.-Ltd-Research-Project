# TrustSense-BMS: Architecture, Inference, and Cryptographic Provenance Specification

## 1. System Overview

**TrustSense-BMS** is a Battery Thermal Intelligence and Trust-Aware Monitoring Platform for electric vehicle battery packs and energy storage systems. It bridges high-frequency telemetry, deep neural virtual sensing, multi-stage cyber-physical trust validation, and verifiable blockchain provenance using Hyperledger Fabric.

```
+----------------------------------------------------------------------------------------------------+
|                                    TRUSTSENSE-BMS RUNTIME PIPELINE                                 |
+----------------------------------------------------------------------------------------------------+
  [Panasonic 18650PF Drive Cycle / Real Sensor Stream]
                          │
                          ▼
  [1. Ingestion Gateway (Express / SSE)]
                          │
                          ▼
  [2. Cyber & Physics Trust Validation Gate]
       ├── Plausibility checks (2.50V - 4.35V, -15A - 10A)
       ├── Power conservation cross-check: |P - (V * I)| < 0.2W
       ├── Physics dV/dt & dI/dt limits
       └── Freshness & replay detection
              │
         ┌────┴───────────────────────────┐
      [BLOCK]                      [SAFE / SUSPICIOUS]
         │                                │
         ▼                                ▼
  [Quarantine DB]           [3. 60-Step Sequence Buffer]
                                          │
                                          ▼
                            [4. CNN-LSTM Inference Microservice]
                                 ├── Conv1D (64 filters, k=3, relu)
                                 ├── LSTM (64 units, seq=True)
                                 ├── LSTM (32 units)
                                 ├── Dense (32) + Dropout(0.2)
                                 └── Dense(1) -> Target Temp (°C)
                                          │ (Target Leakage Strictly Prevented)
                                          ▼
                            [5. Prediction & Residual Analysis]
                                 ├── Predicted Temp (°C)
                                 ├── Held-out Reference Temp (°C)
                                 └── Running Residual & MAE
                                          │
                                          ▼
                            [6. Off-Chain Canonicalization & SHA-256]
                                 ├── Deterministic JSON key ordering
                                 └── SHA-256(canonicalPayload)
                                          │
                                          ▼
                            [7. Merkle Tree Batching (RFC 6962)]
                                 ├── Leaf: SHA256(0x00 || recordHash)
                                 ├── Node: SHA256(0x01 || left || right)
                                 ├── Inclusion Proofs per leaf
                                 └── Root Hash per 30 samples
                                          │
                                          ▼
                            [8. Hyperledger Fabric Ledger Anchoring]
                                 ├── Channel: bmschannel
                                 ├── Chaincode: trustsense-provenance
                                 └── Anchors Batch ID, Root, TxID, Block#
                                          │
                                          ▼
                            [9. Real-Time Dashboard (Next.js 16)]
                                 ├── Live Telemetry & Thermal Gauges
                                 ├── Actual vs Predicted Temperature Chart
                                 ├── Trust Decision & Physics Check Badges
                                 ├── One-Click Record Verification
                                 └── Deliberate Tampering Demonstration
```

---

## 2. Thermal AI Virtual Sensor Specification

### Model Architecture (CNN-LSTM Baseline)
- **Input Shape**: `(60, 6)` — Exactly 60 consecutive time steps with 6 features:
  1. `voltage_v` (Cell voltage in Volts)
  2. `current_a` (Pack current in Amperes, negative = discharge)
  3. `ah` (Accumulated Ampere-hours)
  4. `chamber_temp_degC` (Ambient / environmental chamber temperature)
  5. `power_w` (Instantaneous electrical power in Watts)
  6. `current_abs_a` (Absolute current magnitude in Amperes)
- **Prediction Target**: `battery_temp_degC` (Cell surface temperature in °C).
- **Target Leakage Guarantee**: The measured reference temperature is **strictly isolated** from model input features and preprocessing pipelines. It is retained solely for evaluating residuals and model error.
- **Preprocessing**: `StandardScaler` fitted on Panasonic 18650PF training cycles.

---

## 3. Cybersecurity & Physics Plausibility Filter

Before entering the 60-step sequence buffer, every sample is evaluated by the `TrustValidator`:
1. **Schema & Numeric Integrity**: No NaN, null, or infinite values.
2. **Voltage Envelope**: $2.45\text{ V} \le V \le 4.35\text{ V}$ (safe operating envelope for Panasonic NCR18650PF).
3. **Current Envelope**: $-16.0\text{ A} \le I \le 12.0\text{ A}$.
4. **Power Conservation**: $|P - (V \times I)| \le 0.20\text{ W}$.
5. **Rate-of-Change Limits**: $\left|\frac{dV}{dt}\right| \le 1.2\text{ V/s}$, $\left|\frac{dI}{dt}\right| \le 35\text{ A/s}$.
6. **Freshness & Replay**: Monotonically advancing timestamps; repeated timestamps are flagged as replay attacks.

**Verdicts**:
- `SAFE`: Passes all physical and integrity rules. Pushed to the 60-step buffer.
- `SUSPICIOUS`: Borderline values or minor OOD. Flagged with warnings.
- `BLOCK`: Violates physical laws or schema. Quarantined in database; **blocked from reaching model inference**.

---

## 4. Cryptographic Provenance & Merkle Batching

### Canonical Serialization
To guarantee deterministic SHA-256 hashes across different CPU architectures and programming languages:
- Keys are sorted lexicographically in ascending order.
- Floating-point telemetry numbers are serialized to 4 decimal places (`toFixed(4)`).
- Standardized ISO 8601 timestamps.

### RFC 6962 Domain Separation
To prevent second preimage and extension attacks:
- **Leaf Hash**:
  $$\text{Leaf} = \text{SHA-256}(0x00 \parallel \text{RecordHash})$$
- **Internal Node Hash**:
  $$\text{Node} = \text{SHA-256}(0x01 \parallel \text{LeftChild} \parallel \text{RightChild})$$
- **Odd Leaf Handling**: When a level has an odd number of elements, the last element is duplicated to form a balanced pair.

### Merkle Proof Verification Flow
1. Fetch record canonical payload and calculate `SHA-256(canonicalPayload)`.
2. Assert calculated hash matches the stored `recordHash`.
3. Reconstruct root by hashing `recordHash` up the tree using the inclusion proof steps.
4. Compare reconstructed root with the on-chain Merkle root anchored in Hyperledger Fabric.
5. If match: **VERIFIED**. If mismatch: **TAMPERING DETECTED**.

---

## 5. Hyperledger Fabric Smart Contract (Chaincode)

Go Chaincode (`chaincode/provenance/provenance.go`):
- `AnchorBatch(ctx, batchID, merkleRoot, leafCount, startRecordID, endRecordID, modelVersion, batteryID)`
- `GetBatch(ctx, batchID)`
- `VerifyInclusionOnChain(ctx, batchID, recordHash, proofJSON)`
- `GetBatteryPassport(ctx, batteryID)`

---

## 6. End-to-End Verification Command

Run the complete 10-phase automated test suite:
```bash
npm run test:trustsense
```
Outputs explicit assertions for dataset loading, 60-step inference, target leakage prevention, trust quarantine, canonical SHA-256, Merkle proofs, Fabric anchoring, and deliberate tampering detection.
