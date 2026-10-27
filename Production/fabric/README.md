# TrustSense-BMS: Hyperledger Fabric Development Network (v2.5 LTS)

This directory contains the reproducible development network configuration, cryptographic definitions, chaincode packages, and automation scripts for running a genuine Hyperledger Fabric v2.5 LTS network for the TrustSense-BMS / ECUlytics battery telemetry provenance pipeline.

---

## Architecture Overview

- **Hyperledger Fabric Version:** v2.5.9 LTS
- **Channel Name:** `bmschannel`
- **Chaincode Name:** `trustsense-provenance` (version `1.0`, sequence `1`)
- **Chaincode Deployment Model:** Chaincode-as-a-Service (CCaaS) via peer built-in `ccaas_builder`
- **Chaincode Server:** Standalone Go service (`trustsense-chaincode:9999`)
- **Ordering Service:** Raft consensus (`orderer.example.com:7050`, OSN Admin `7053`)
- **Peer Organization:** `Org1` (`Org1MSP`, `peer0.org1.example.com:7051`)
- **Certificate Authority:** `ca.org1.example.com:7054`
- **Application Capabilities:** `V2_5`
- **Client Integration:** `@hyperledger/fabric-gateway` v1.13.0 + `@grpc/grpc-js` v1.14.6
- **Status:** **LIVE & OPERATIONAL** in Docker on WSL 2

---

## Directory Structure

```
Production/fabric/
├── docker-compose.fabric.yml      # Multi-container orchestration (Orderer, Peer, CA, CLI)
├── configtx.yaml                  # Channel & MSP configuration with V2_5 capabilities
├── crypto-config.yaml             # Cryptogen identity specification
├── connection-profile.json        # Client Gateway connection profile
├── test-crypto/                   # Local dev TLS certs & PKCS#8 private keys for testing
├── scripts/
│   ├── bootstrap_network.ps1      # PowerShell one-command network bootstrapper (full lifecycle)
│   ├── bootstrap_network.sh       # Bash one-command network bootstrapper (Linux/WSL)
│   ├── teardown_network.ps1       # Clean volume teardown script (PowerShell)
│   ├── teardown_network.sh        # Clean volume teardown script (Bash)
│   └── generate_test_crypto.js    # Dev certificate generator for SDK testing
└── README.md                      # This documentation
```

---

## Host Environment & Prerequisites

### Current Machine Audit (Windows 11 Home 64-bit)

- **CPU Virtualization:** `AMD Ryzen 5 5600H with Radeon Graphics` — Hardware virtualization is **ENABLED** in BIOS/firmware (`VirtualizationFirmwareEnabled: True`).
- **Docker Desktop:** Installed (`Docker.DockerDesktop 4.96.3` with Docker CLI `29.9.2` and Compose `v5.6.1`).
- **Prerequisite Boundary:** Windows feature `VirtualMachinePlatform` must be activated with Administrator privileges, followed by a system reboot to initialize the Windows hypervisor.

### Activation Steps (Requires Administrator Approval)

1. Open an **Administrator PowerShell** prompt (Right-click Windows Start $\to$ "Terminal (Admin)" or "PowerShell (Admin)"):
   ```powershell
   dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
   dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
   ```

2. **Reboot Windows** to allow the Windows kernel to initialize the hypervisor:
   ```powershell
   Restart-Computer
   ```

3. After reboot, launch **Docker Desktop**. The Linux container engine will initialize via WSL 2 / Virtual Machine Platform.

---

## Quickstart: Bootstrapping the Network

Once Docker Desktop shows green ("Engine running"):

### Windows (PowerShell)

1. Open PowerShell and navigate to this directory:
   ```powershell
   cd "Production/fabric"
   ```

2. Run the bootstrap script:
   ```powershell
   .\scripts\bootstrap_network.ps1
   ```

   The script automatically:
   - Verifies Docker daemon status and PATH resolution.
   - Generates MSP cryptographic identities via `cryptogen` using `hyperledger/fabric-tools:2.5.9`.
   - Generates the `bmschannel.block` channel genesis block using `configtxgen`.
   - Starts the Orderer (`7050`), Peer (`7051`), CA (`7054`), and CLI containers.
   - Joins `peer0.org1.example.com` to `bmschannel`.
   - Packages, installs, approves, and commits the `trustsense-provenance` chaincode.
   - Invokes `InitLedger` on-chain to initialize smart contract state.
   - Exports client identity certificates into `test-crypto/` for the Fabric Gateway SDK.

### Linux / macOS / WSL 2 (Bash)

```bash
cd Production/fabric
chmod +x scripts/*.sh
./scripts/bootstrap_network.sh
```

---

## Configuring the Backend Application

Once the peer network is running, configure `Development/backend/.env`:

```env
# Hyperledger Fabric Network Configuration
FABRIC_PEER_ENDPOINT=localhost:7051
FABRIC_PEER_HOST_OVERRIDE=peer0.org1.example.com
FABRIC_CHANNEL=bmschannel
FABRIC_CHAINCODE=trustsense-provenance
FABRIC_MSP_ID=Org1MSP
FABRIC_TLS_CERT_PATH=Production/fabric/test-crypto/ca.crt
FABRIC_USER_CERT_PATH=Production/fabric/test-crypto/user.crt
FABRIC_USER_KEY_PATH=Production/fabric/test-crypto/user.key
FABRIC_GATEWAY_TIMEOUT_MS=5000
```

---

## Verifying the Network & Transactions

From `Development/backend`:

1. **Run the Fabric Verification Pipeline:**
   ```powershell
   npm run verify:fabric
   ```
   This probes the peer, anchors a test batch, updates the Digital Battery Passport, and verifies an RFC 6962 inclusion proof.

2. **Run the Comprehensive Fabric Test Suite:**
   ```powershell
   npm run test:fabric
   ```
   Validates channel configuration, offline peer error handling, X.509 cert parsing, batch sequencing, and cryptographic tamper rejection.

3. **Check Truthful Provider Diagnostics:**
   ```powershell
   npm run diagnostics:providers
   ```
   Reports the live operational state:
   - When peer is running and verified: `FABRIC_TRANSACTION_VERIFIED` (`Local_Fallback: INACTIVE`)
   - When peer is offline: `FABRIC_UNAVAILABLE` (`PEER_UNREACHABLE_OR_OFFLINE`, `Local_Fallback: ACTIVE`)
   - When peer is unconfigured: `LOCAL_ADAPTER_ACTIVE` (`PEER_ENDPOINT_NOT_CONFIGURED`, `Local_Fallback: ACTIVE`)

---

## Teardown & Cleanup

To stop all containers and remove temporary volumes:

```powershell
cd "Production/fabric"
.\scripts\teardown_network.ps1
```

Or on Linux/WSL:
```bash
./scripts/teardown_network.sh
```

---

## Truthful Fallback Architecture

TrustSense-BMS is designed for resilient zero-data-loss operation:
- If the Fabric network is offline or unconfigured, the application gracefully activates its audited PostgreSQL RFC 6962 ledger adapter (`LOCAL_DEV_NETWORK`, `LOCAL_DB_ANCHORED`).
- Every batch is sequentially numbered and anchored with canonical SHA-256 Merkle roots.
- When the live Fabric network becomes available, the Gateway client resumes on-chain transaction submissions automatically.
