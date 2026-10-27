# ECUlytics & TrustSense-BMS: Production Deployment Architecture & Operational Plan

> **Platform:** ECUlytics Enterprise Battery Management & TrustSense-BMS Provenance Engine  
> **Environment:** Production Hosting, Marine Fleet Telemetry & Distributed Ledger Ingestion  
> **Classification:** High-Availability Decision-Support Architecture

---

## 1. Executive Summary & Topology Overview

TrustSense-BMS is an enterprise battery intelligence and tamper-evident data provenance system. It ingests high-frequency BMS telemetry, executes real-time virtual thermal sensor inference (CNN-LSTM), calculates health indicators (hotspot divergence $\Delta T$, rate-of-rise $dT/dt$, cooling effectiveness), establishes cryptographic Merkle audit trees (RFC 6962), stores verifiable evidence packages in AWS S3, and commits batch root anchors to a Hyperledger Fabric distributed ledger.

```
                      [ Marine Vessel Fleet / Edge Telemetry Gateways ]
                                            │
                                  HTTPS / WSS / TLS 1.3
                                            ▼
                      ┌───────────────────────────────────────────────┐
                      │          Nginx Enterprise Reverse Proxy       │
                      │  - SSL Termination (TLS 1.2 / TLS 1.3, HSTS)  │
                      │  - Rate Limiting, Request ID Correlation      │
                      │  - Static Asset Delivery & Gzip Compression   │
                      └──────────────┬─────────────────┬──────────────┘
                                     │                 │
             / (UI Routing)          │                 │ /api/*, /health, /ready
                                     ▼                 ▼
          ┌────────────────────────────┐    ┌──────────────────────────────────┐
          │  Frontend UI Service       │    │  Backend API Gateway             │
          │  Next.js 16 (Standalone)   │    │  Node.js 20 Express + TypeScript │
          │  Port: 3000                │    │  Port: 3001                      │
          └────────────────────────────┘    └──────┬───────┬────────────┬──────┘
                                                   │       │            │
                           Internal RPC / REST     │       │            │
                     ┌─────────────────────────────┘       │            │
                     ▼                                     │            │
      ┌──────────────────────────────┐                     │            │
      │  Thermal AI Microservice     │                     │            │
      │  FastAPI + TensorFlow 2.18   │                     │            │
      │  Port: 8000                  │                     │            │
      └──────────────────────────────┘                     │            │
                                                           │            │
              PostgreSQL 16 (Drizzle ORM)                  │            │
              ┌────────────────────────────────────────────┘            │
              ▼                                                         ▼
      ┌──────────────────────────────┐                  ┌──────────────────────────────┐
      │  PostgreSQL 16 Database      │                  │  AWS S3 Evidence Storage     │
      │  - Fleet Data & Passports    │                  │  - Merkle Batch Evidence JSON│
      │  - Billing & Audit Ledger    │                  │  - AES-256 SSE, Block Public │
      │  - Automated WAL Archiving   │                  │  - Workload IAM Role Auth    │
      └──────────────────────────────┘                  └──────────────────────────────┘
                                                                        │
                                       gRPC / TLS 1.3                   │
                     ┌──────────────────────────────────────────────────┘
                     ▼
      ┌─────────────────────────────────────────────────────────────────┐
      │  Hyperledger Fabric v2.5 Blockchain Consortium                 │
      │  - Channel: bmschannel                                          │
      │  - Chaincode: trustsense-provenance (Go CCaaS)                  │
      │  - Distributed Raft Orderer Quorum & Organization Peers        │
      │  - Cryptographic RFC 6962 Merkle Inclusion Verification         │
      └─────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Hosting & HTTPS

### A. Technology Stack & Build Output
- **Framework:** Next.js 16 (App Router, React 19).
- **Packaging:** Standalone build output (`output: 'standalone'`), minimizing image size to $< 200\text{ MB}$ by bundling only production dependencies.
- **Node Runtime:** Node.js 20 Alpine Linux base.

### B. Reverse Proxy & Edge Termination
- **Proxy Server:** Nginx 1.25+ or AWS Application Load Balancer (ALB).
- **TLS Configuration:** Modern TLS 1.2 and TLS 1.3 only; ECDHE ciphers; Session tickets disabled; Session caching enabled.
- **Security Headers:**
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Frame-Options: SAMEORIGIN`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy`: Disallowing unverified external scripts, restricting frame ancestors.

---

## 3. Backend Hosting, Process Supervision & Health Checks

### A. Runtime & Process Supervision
- **Runtime:** Node.js 20 LTS.
- **Containerization:** Multi-stage `Dockerfile.backend` with non-root user execution (`USER node`).
- **Supervision:** PM2 cluster mode or Kubernetes deployment with ReplicaSet ($N \ge 2$).
- **Lifecycle Management:**
  - Graceful shutdown on `SIGTERM` / `SIGINT`: stops accepting new requests, drains pending requests, halts data acquisition manager, and drains PostgreSQL connection pool within a 10-second timeout window.

### B. Health Probes
- **Liveness Probe (`/health`):**
  - Instantaneous check returning HTTP 200 `{ status: "ok", uptime: <seconds> }`.
  - Used by load balancers and container runtimes to detect process deadlocks.
- **Readiness Probe (`/ready`):**
  - Deep dependency check evaluating:
    1. PostgreSQL connectivity (`SELECT 1;`) and query latency.
    2. Python ML Virtual Sensor connectivity (`http://thermal-inference:8000/health`).
    3. AWS S3 storage status (IAM credential availability, bucket target).
    4. Hyperledger Fabric gateway status (peer connection, channel readiness).
    5. Razorpay provider configuration status.
  - Returns HTTP 200 when core dependencies are healthy; HTTP 503 when critical services (database) are unreachable.

---

## 4. PostgreSQL Persistence, Backup & Disaster Recovery

### A. Persistence & Connection Management
- **Database Engine:** PostgreSQL 16 Alpine.
- **Storage:** Dedicated persistent volume mount (`/var/lib/postgresql/data`) on SSD/EBS gp3 with automated encryption at rest.
- **Connection Pooling:** `node-postgres` `Pool` with max 20 connections per instance, connection idle timeout (30s), and statement timeout (10s) to prevent runaway lock contention.

### B. Automated Backup Strategy
1. **Continuous WAL Archiving:** Write-Ahead Logs (WAL) continuously streamed to a secured, immutable cloud storage bucket.
2. **Daily Logical Backups:** Automated `pg_dump` scheduled at 02:00 UTC daily:
   ```bash
   pg_dump -U eculytics_admin -Fc -d eculytics_prod | gzip > /backups/eculytics_$(date +%Y%m%d_%H%M%S).dump.gz
   ```
3. **Point-In-Time Recovery (PITR):** Enables restoration to any arbitrary second within the last 30 days using the base backup + replay of WAL segments.
4. **Recovery Time Objective (RTO):** $\le 30\text{ minutes}$.
5. **Recovery Point Objective (RPO):** $\le 5\text{ minutes}$.

---

## 5. ML Inference Service & Model Delivery

### A. Virtual Thermal Sensor Architecture
- **Framework:** FastAPI with Python 3.12 and TensorFlow 2.18.
- **Model Topology:** CNN-LSTM dual-head recurrent network predicting cell temperatures and residual deviations from voltage, current, ambient temperature, and state-of-charge.
- **Model Artifacts:**
  - Model weights: `cnn_lstm_battery_temperature_fixed.keras` (545 KB).
  - Scalers: `feature_scaler.pkl` (759 B) and `target_scaler.pkl` (623 B).
- **Integrity Verification:** Model artifacts are verified via SHA-256 hash checksums upon container startup to guard against weight tampering or corrupted downloads.

### B. Advisory Decision-Support Constraint
- The ML inference engine operates strictly as an **advisory and diagnostic intelligence layer**. It computes anomaly scores, thermal rate-of-rise ($dT/dt$), and cooling effectiveness indexes. It **never** directly issues actuator override commands or bypasses physical BMS hardware safety interlocks.

---

## 6. AWS Evidence Storage & IAM Workload Roles

### A. Environment-Specific Authentication Architecture

| Aspect | Local Development | Production Hosting |
| :--- | :--- | :--- |
| **Identity Mechanism** | Local AWS CLI Named Profile (`trustsense-restricted`) | Workload Role (ECS Task Role / EC2 Instance Profile / EKS IRSA) |
| **Source Identity** | Restricted IAM User `trustsense-s3-app` | Native Container/Host Metadata Service (`IMDSv2`) |
| **AssumeRole Target** | `arn:aws:iam::218733195047:role/TrustSenseEvidenceStorageRole` | Same Role attached directly to Task/Instance |
| **Long-Lived Keys** | Source key strictly limited to `sts:AssumeRole` (0 S3 permissions) | **Zero long-lived access keys** present on filesystem or in environment |
| **SDK Behavior** | `new S3Client({ region, profile: process.env.AWS_PROFILE })` | `new S3Client({ region })` (Default Provider Chain auto-discovery) |

### B. Bucket Security Controls
- **Target Bucket:** `trustsense-evidence-218733195047-ap-south-1` (Mumbai).
- **Public Access:** All 4 S3 Block Public Access controls enabled (`IgnorePublicAcls`, `BlockPublicAcls`, `BlockPublicPolicy`, `RestrictPublicBuckets`).
- **Object Ownership:** `BucketOwnerEnforced` (ACLs disabled).
- **Encryption:** Server-Side Encryption with Amazon S3 managed keys (SSE-S3 AES-256) enforced on all `PutObject` requests.
- **Immutability:** S3 Object Lock (Compliance/Governance mode) or bucket lifecycle retention rules prevent unauthorized tampering of finalized Merkle evidence files.

---

## 7. Hyperledger Fabric: Local Development vs Production Consortium

### A. Comparative Topology Analysis

| Architectural Dimension | Local Development (Current State) | Production Enterprise Consortium (Target) |
| :--- | :--- | :--- |
| **Network Topology** | Single Organization (`Org1MSP`) | Multi-Organization Consortium (e.g., Vessel Operator, Battery OEM, Class Society/Auditor) |
| **Consensus Ordering** | Single Raft Orderer node (`orderer.example.com`) | Distributed Raft CFT/BFT Quorum (minimum 3–5 orderer nodes across independent availability zones) |
| **Peer Nodes** | 1 Peer (`peer0.org1.example.com`) | $\ge 2$ redundant peers per organization across distinct VPCs/regions |
| **Identity & MSP** | Local Cryptogen / Fabric-CA test certificates | Production Fabric CA hierarchy with separate Root TLS CA, Intermediate Org CAs, and CRL management |
| **Private Key Security**| Filesystem PEM files mounted in container | Hardware Security Module (HSM / PKCS#11) or HashiCorp Vault key isolation |
| **Chaincode Runtime** | Single CCaaS Docker container on local bridge | Multi-instance CCaaS with health monitoring, automatic restart, and rolling upgrade support |
| **State Database** | LevelDB embedded in peer | CouchDB cluster with query indexing and high-throughput volume persistence |
| **Ledger Persistence** | Docker Named Volumes | Cloud-managed block storage (EBS gp3 / Ceph) with snapshot backup schedules |

### B. Smart Contract & Channel Parity
- **Channel Name:** `bmschannel`
- **Chaincode ID:** `trustsense-provenance`
- **Smart Contract Capabilities:** Both local and production share the exact same deterministic Go CCaaS logic:
  - `AnchorBatch(batchId, merkleRoot, recordCount, startTimestamp, endTimestamp, evidenceS3Key, evidenceSha256)`
  - `VerifyInclusion(batchId, leafHash, proofHashes, proofPositions)`
  - `QueryBatch(batchId)` and `QueryPassport(batteryId)`
- **RFC 6962 Verification:** Valid inclusion proofs pass; tampered leaf hashes, tampered sibling hashes, and inverted proof positions are rejected deterministically by the smart contract.

---

## 8. Hardened Configuration, Secrets & Observability

### A. Cryptographic Secrets
1. **JWT Secret:** In production mode (`NODE_ENV=production`), `JWT_SECRET` must be $\ge 32$ characters without placeholder strings; fatal exception on startup otherwise.
2. **Password Hashing:** Passwords hashed with cryptographic salts using `crypto.scryptSync(password, salt, 64)`. Verification uses constant-time `crypto.timingSafeEqual` to eliminate timing attacks.
3. **Razorpay Webhooks:** Authenticated via raw body HMAC-SHA256 comparison using `timingSafeEqual`. Handlers are strictly idempotent.
4. **Secrets Delivery:** Production secrets must be injected at container launch via AWS Secrets Manager or HashiCorp Vault. Zero secret values committed to Git.

### B. Observability & Telemetry
1. **Request Tracking:** Every HTTP request receives a unique `X-Request-Id` UUID for end-to-end tracing across reverse proxy, backend gateway, and database logs.
2. **Metrics Collection:** `trafficTracker` aggregates request counts, error rates, p50/p95/p99 latency, and bandwidth consumption by tenant.
3. **Structured Logs:** Formatted as structured JSON with log levels (`INFO`, `WARN`, `ERROR`), timestamps, correlation IDs, and sanitized parameters (passwords, tokens, and keys excluded).

---

# 9. Rollout, Rollback & Disaster Recovery Runbook

### A. Deployment Strategy (Blue-Green)
1. **Stage 1 (Build & Test):** Build backend and frontend images, run all unit/integration tests, and verify Docker images in staging registry.
2. **Stage 2 (Green Launch):** Deploy updated containers on isolated ports; verify `/health` and `/ready` probes.
3. **Stage 3 (Traffic Cutover):** Update Nginx upstream configuration or ALB target group to redirect traffic to Green.
4. **Stage 4 (Observation):** Monitor error rates and p95 latency for 15 minutes.
5. **Stage 5 (Teardown):** Gracefully terminate Blue containers once Green is confirmed stable.

### B. Emergency Rollback Procedure
If error rate spikes ($> 1\%$) or `/ready` probe fails post-cutover:
```bash
# 1. Immediately switch Nginx upstream back to Blue
sed -i 's/server 127.0.0.1:3002/server 127.0.0.1:3001/' /etc/nginx/conf.d/eculytics.conf
nginx -s reload

# 2. Verify restored health
curl -f http://localhost:3001/health

# 3. Halt faulty green container
docker stop trustsense-backend-green
```

---

## 10. Staging Release Candidate & Operational Verification Runbook

### A. Staging Topology & Loopback Isolation
The Phase 14 Staging Release Candidate runs in an isolated network overlay (`trustsense-staging-net`), linking dynamically to the local Hyperledger Fabric consortium (`trustsense-fabric`), and binding strictly to host loopback interfaces (`127.0.0.1`) to prevent external exposure and avoid port conflicts with development services:

| Component | Container Name | Staging Port Binding | Dev Port | Runtime Base / Framework |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL 16** | `trustsense-staging-postgres` | `127.0.0.1:5433:5432` | `5432` | `postgres:16-alpine` |
| **Thermal AI Virtual Sensor** | `trustsense-staging-thermal-ai` | `127.0.0.1:8002:8000` | `8000` | Python 3.12 + FastAPI + TensorFlow 2.18 CPU |
| **Backend API Gateway** | `trustsense-staging-backend` | `127.0.0.1:3011:3001` | `3001` | Node.js 20 Alpine + Express + Drizzle ORM |
| **Frontend UI** | `trustsense-staging-frontend` | `127.0.0.1:3010:3000` | `3000` | Next.js 16.4.3 Standalone + React 19 |
| **Hyperledger Fabric v2.5** | `peer0.org1.example.com` | `127.0.0.1:7051` | `7051` | Hyperledger Fabric v2.5.9 Gateway & Raft Orderer |

### B. Verified Lifecycle Operations

#### 1. Build Container Images
From the repository root:
```bash
# Backend image (Multi-stage Node 20, ~320 MB)
docker build -t trustsense-backend:staging -f Production/docker/Dockerfile.backend .

# Thermal AI Virtual Sensor image (FastAPI + TF 2.18 CPU, ~2.75 GB)
docker build -t trustsense-thermal-ai:staging -f Production/docker/Dockerfile.inference .

# Frontend UI image (Next.js 16 Standalone, ~1.08 GB)
docker build -t trustsense-frontend:staging -f Production/docker/Dockerfile.frontend .
```

#### 2. Start Staging Environment
```bash
# Launch all staging services in background
docker compose -f Production/docker/docker-compose.staging.yml up -d

# Verify health status of running services
docker compose -f Production/docker/docker-compose.staging.yml ps
```

#### 3. Run Staging Release Candidate Acceptance Suite
From `Development/backend`:
```bash
# Executes 64 automated assertions across 12 operational gates against live staging ports
npm run test:staging
```

#### 4. Graceful Staging Teardown
```bash
# Stops staging containers and preserves persistent volumes (Fabric network left untouched)
docker compose -f Production/docker/docker-compose.staging.yml down
```

### C. Database Backup, Checksum & Restore Runbook

The platform provides verified, binary-safe PowerShell and Bash scripts in `Production/scripts/` utilizing `docker cp` to prevent Windows standard stream binary corruption:

#### 1. Automated Database Backup
```powershell
# Windows PowerShell
.\Production\scripts\backup_db.ps1 -ContainerName trustsense-staging-postgres -DbName eculytics_staging -DbUser eculytics_admin
```
```bash
# Linux / macOS Bash
./Production/scripts/backup_db.sh -c trustsense-staging-postgres -d eculytics_staging -u eculytics_admin
```
**Output:** Generates `Production/backups/eculytics_backup_<YYYYMMDD_HHMMSS>.dump` alongside an accompanying `.sha256` verification file containing the SHA-256 digest of the backup archive.

#### 2. Checksum-Verified Database Restore
```powershell
# Windows PowerShell (Validates SHA-256 integrity before touching PostgreSQL)
.\Production\scripts\restore_db.ps1 -BackupFile .\Production\backups\eculytics_backup_20261024_205658.dump -ContainerName trustsense-staging-postgres -DbName eculytics_staging -DbUser eculytics_admin
```
```bash
# Linux / macOS Bash
./Production/scripts/restore_db.sh -f ./Production/backups/eculytics_backup_20261024_205658.dump -c trustsense-staging-postgres -d eculytics_staging -u eculytics_admin
```
**Anti-Tamper Rejection:** If the `.dump` archive is modified, truncated, or its `.sha256` digest does not strictly match, the restore script terminates immediately with exit code 1, aborting execution before database catalogs are affected.

### D. DevOps Troubleshooting Guide

| Issue Encountered | Root Cause | Verified Remediation |
| :--- | :--- | :--- |
| `EACCES: permission denied, mkdir '/app/uploads'` | Backend container executes as non-root `USER node` but upload directory root was owned by `root`. | Pre-create `/app/uploads` and `/app/uploads/evidence` with `chown -R node:node /app/uploads` in `Dockerfile.backend`. |
| `EACCES: permission denied, open '/etc/fabric/crypto/user.key'` | Host crypto key mounted into Alpine with restrictive host mode `0600`. | Run `chmod 644 Production/fabric/test-crypto/user.key` to allow container non-root `node` user read access. |
| `Unsupported private key type: rsa` | Environment variable name mismatch (`FABRIC_CERT_PATH` vs `FABRIC_USER_CERT_PATH`) triggering fallback mock key. | Set both canonical and legacy aliases in `docker-compose.staging.yml` and `ledger.ts`. |
| `Inference service unavailable (localhost:8000)` | Backend readiness probe had hardcoded `localhost:8000` instead of inter-service container DNS. | Reference `process.env.THERMAL_AI_URL` (`http://staging-thermal-ai:8000/health`) dynamically in `/ready`. |
| `Inference error: "INVALID INPUT"` with valid telemetry | Missing or `None` values in non-feature columns (such as optional `time_s`) triggering global `.isnull().any()`. | Explicitly restrict null-checking to designated feature columns: `features_df[self.feature_columns].isnull().values.any()`. |
| Corrupted database dump files (`pg_restore: archiver bad header`) | PowerShell `>` stdout redirection corrupts binary streams. | Use binary-safe `docker cp` to transport `.dump` archives into and out of containers. |

### E. Human-Authorization Production Release Boundaries

The Staging Release Candidate is fully verified and self-contained. The following operations represent explicit external human-authorization boundaries that require manual operational sign-off:

1. **DNS & Edge TLS Cutover:**
   - Provision public DNS `A`/`CNAME` records pointing `eculytics.vgmarine.com` to production load balancer.
   - Deploy signed SSL/TLS certificates (AWS ACM or Let's Encrypt).
2. **Cloud Workload Role Attachment:**
   - Attach IAM role `arn:aws:iam::218733195047:role/TrustSenseEvidenceStorageRole` to the target ECS Task Role or EC2 Instance Profile (omitting local credentials).
3. **Razorpay Live Merchant Activation:**
   - Switch credentials from Test Mode (`rzp_test_TrEgT04YnyqX6j`) to Live Merchant credentials (`rzp_live_*`) after merchant KYC verification and commercial authorization.
4. **Blockchain Consortium Peer Expansion:**
   - Transition from the local single-organization Raft cluster (`Org1MSP`) to multi-organization consortium peers (Vessel Operator, Battery Manufacturer, Maritime Class Society).

---

## 11. Cloud Target Architecture, Sizing & Production Cost Analysis (AWS ap-south-1)

### A. AWS Evaluation & Target Hosting Topology
AWS is selected as the primary cloud hosting target because the platform's evidence storage is already hosted in AWS S3 (`trustsense-evidence-218733195047-ap-south-1`) in Region `ap-south-1` (Mumbai). Utilizing `ap-south-1` co-locates compute with storage, reducing cross-region egress costs to $0 and providing sub-5ms internal storage latency.

#### Service Sizing & Compute Profiles:

| Service / Workload | CPU Allocation | Memory (RAM) Allocation | Storage Volume | Network Exposure |
| :--- | :---: | :---: | :---: | :--- |
| **Nginx Edge Reverse Proxy** | 0.25 vCPU | 128 MB | Ephemeral | **Public (80/TCP, 443/TCP)** |
| **Frontend UI (Next.js 16)** | 0.50 vCPU | 512 MB | Ephemeral | Internal Bridge Only (`3000/TCP`) |
| **Backend API (Node 20)** | 0.50 vCPU | 512 MB | 10 GB gp3 (`uploads/`) | Internal Bridge Only (`3001/TCP`) |
| **Thermal AI (FastAPI + TF)** | 1.00 vCPU | 1,536 MB | Ephemeral (weights cached) | Internal Bridge Only (`8000/TCP`) |
| **PostgreSQL 16 Engine** | 0.50 vCPU | 1,024 MB | 50 GB gp3 SSD (WAL enabled) | Internal Bridge Only (`5432/TCP`) |
| **Total Aggregate Minimum** | **2.75 vCPU** | **3.7 GB RAM** | **60 GB gp3 SSD** | **Zero backend exposure** |

---

### B. Hosting Model Comparison & Itemized Monthly Cost Projections

All pricing is based on AWS India (`ap-south-1`, Mumbai) On-Demand and Savings Plan rates:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   AWS AP-SOUTH-1 PRODUCTION COST COMPARISON                      │
├────────────────────────────────────────┬─────────────────────────────────────────┤
│  OPTION A: Dedicated Hardened EC2 Host │  OPTION B: Managed Multi-Tier Cluster   │
│  (Recommended for Pilot / Launch)      │  (Target for Scale / High-Concurrence)  │
├────────────────────────────────────────┼─────────────────────────────────────────┤
│  • EC2 t3.large (2 vCPU, 8 GB RAM):    │  • AWS Application Load Balancer:       │
│    $60.74 / mo (On-Demand)             │    $22.50 / mo base + $5.00 LCU = $27.50│
│    $37.00 / mo (1-yr Savings Plan)     │  • ECS Fargate Tasks (3 services):      │
│  • 60 GB gp3 EBS Volume:               │    2.0 vCPU, 4.0 GB RAM = $59.20 / mo   │
│    $6.84 / mo                          │  • Amazon RDS PostgreSQL (db.t4g.med):  │
│  • Elastic IP: $0.00 (attached)        │    $50.40 / mo (Single-AZ)              │
│  • AWS S3 Storage & API: ~$1.50 / mo   │  • RDS 50 GB gp3 Storage: $5.75 / mo    │
│  • CloudWatch Basic Metrics: Free      │  • AWS Secrets Manager (4 secrets):$1.60│
│  • Outbound Data Transfer: ~$2.00 / mo │  • Route 53 Hosted Zone: $0.50 / mo     │
│                                        │  • S3 Storage & Transfer: ~$5.00 / mo   │
├────────────────────────────────────────┼─────────────────────────────────────────┤
│  TOTAL: ~$71.08 / mo (On-Demand)       │  TOTAL: ~$150.00 - $180.00 / mo         │
│         ~$47.34 / mo (Savings Plan)    │                                         │
└────────────────────────────────────────┴─────────────────────────────────────────┘
```

#### Recommendation:
**Option A (Dedicated Hardened EC2 Host with Docker Compose + Let's Encrypt / Host Nginx)** is strongly recommended for the initial commercial launch. It delivers complete hardware isolation, eliminates multi-service AWS management overhead, satisfies all performance SLAs (< 50ms API p95, < 250ms thermal inference), and minimizes infrastructure spend to ~$71/month.

---

### C. Secure Workload Identity (Zero Long-Lived Credentials)

1. **IAM Role:** `arn:aws:iam::218733195047:role/TrustSenseEvidenceStorageRole`
2. **Workload Attachment:**
   - **For EC2:** Associated directly via an IAM Instance Profile (`TrustSenseInstanceProfile`).
   - **For ECS:** Associated directly as the ECS `taskRoleArn`.
3. **Container Environment Posture:**
   - Production container environment strictly **omits** `AWS_PROFILE`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`.
   - The AWS SDK v3 automatically inherits temporary, auto-rotating session tokens directly from the AWS Instance Metadata Service (IMDSv2) or ECS task metadata endpoint.
   - Zero long-lived AWS secrets reside in `.env`, Docker images, or container filesystems.

---

### D. Production Network & Security Group Isolation

| Security Group Rule | Protocol | Port Range | Source / Destination | Security Rationale |
| :--- | :---: | :---: | :--- | :--- |
| **Inbound HTTPS** | TCP | `443` | `0.0.0.0/0` | Public TLS ingress for client web dashboard and vessel telemetry gateways. |
| **Inbound HTTP** | TCP | `80` | `0.0.0.0/0` | Permanent redirect (HTTP 301) to HTTPS; ACME HTTP-01 challenge for Certbot. |
| **Inbound SSH** | TCP | `22` | Authorized Bastion / Operator CIDR | Restricted administrative access; disabled if using AWS Systems Manager (SSM). |
| **Internal PostgreSQL** | TCP | `5432` | Container Bridge Network Only | Strictly blocked externally; accessible only from backend container. |
| **Internal Thermal AI** | TCP | `8000` | Container Bridge Network Only | Strictly blocked externally; accessible only from backend container. |
| **Internal Backend API**| TCP | `3001` | Container Bridge Network Only | Reverse-proxied via Nginx; no raw port binding to public interfaces. |
| **Internal Frontend** | TCP | `3000` | Container Bridge Network Only | Reverse-proxied via Nginx; no raw port binding to public interfaces. |
| **Outbound S3** | HTTPS | `443` | AWS S3 Service Gateway (`s3.ap-south-1.amazonaws.com`) | Least-privilege object operations (`PutObject`, `GetObject`, `DeleteObject`). |
| **Outbound Razorpay** | HTTPS | `443` | `api.razorpay.com` | Order creation and payment status queries over TLS 1.3. |
| **Outbound Blockchain**| TCP | `7051` | Authorized Peer Endpoints (mTLS) | Anchoring Merkle root batches to consortium ledger. |


