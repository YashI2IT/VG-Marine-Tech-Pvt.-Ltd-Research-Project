# Production Environment & Deployment Architecture

> **ECUlytics & TrustSense-BMS Enterprise Battery Analytics Platform**  
> Target: High-Availability Marine Fleet Operations & BMS Telemetry

---

## 1. Overview
The `Production/` directory encapsulates all production-grade container specifications, reverse-proxy configurations, infrastructure-as-code manifests, and deployment automation scripts for enterprise deployment.

## 2. Directory Structure
```
Production/
├── config/                  # Runtime environment templates & Nginx topology
│   ├── nginx.conf           # SSL termination, HTTP/2, security headers & API routing
│   ├── production.env.example # Template for production secrets and database URLs
│   └── staging.env          # Validated staging release candidate environment configuration
├── docker/                  # Multi-stage production and staging container definitions
│   ├── Dockerfile.backend   # Multi-stage Node.js 20 production/staging container (non-root `node`)
│   ├── Dockerfile.frontend  # Next.js 16.4.3 standalone production/staging container
│   ├── Dockerfile.inference # Python 3.12 + FastAPI + TensorFlow 2.18 CPU virtual sensor container
│   ├── docker-compose.prod.yml # Production multi-service orchestration
│   └── docker-compose.staging.yml # Isolated loopback staging environment (ports 5433, 8002, 3011, 3010)
├── scripts/                 # Validated backup, restore, and maintenance utilities
│   ├── backup_db.ps1        # PowerShell automated binary-safe DB dump + SHA-256 generation
│   ├── restore_db.ps1       # PowerShell checksum-verified DB restore with anti-tamper abort
│   ├── backup_db.sh         # Linux/macOS binary-safe DB backup script
│   └── restore_db.sh        # Linux/macOS checksum-verified DB restore script
├── backups/                 # Timestamped database dumps and accompanying .sha256 digests
└── deployment/              # Daemon services, health checks & zero-downtime scripts
    ├── deploy_docker.sh     # Production Docker zero-downtime deployment script with health probes
    ├── deploy.sh            # Bare-metal systemd deployment script with health verification
    ├── eculytics-backend.service  # Systemd service definition for API gateway
    ├── eculytics-frontend.service # Systemd service definition for Next.js web app
    └── HEALTHCHECK.md       # Liveness, deep readiness & SLA probe documentation
```

## 3. Staging Release Candidate Operations

### A. Start Staging Environment (Loopback Isolated)
```bash
# Build and start all staging containers in background
docker compose -f Production/docker/docker-compose.staging.yml up -d

# Verify container health status
docker compose -f Production/docker/docker-compose.staging.yml ps
```
The staging environment binds strictly to loopback (`127.0.0.1`):
- **PostgreSQL 16:** `127.0.0.1:5433`
- **Thermal AI Virtual Sensor:** `127.0.0.1:8002`
- **Backend API Gateway:** `127.0.0.1:3011`
- **Frontend Web UI:** `127.0.0.1:3010`

### B. Run Staging Release Candidate Acceptance Suite
```bash
# From Development/backend directory
npm run test:staging
```
Executes 64 automated assertions across 12 operational gates (Startup, Auth/RBAC, Quarantine, Model Contract, Thermal AI, S3 Evidence, Merkle Trees, Fabric Ledger, Razorpay Test Mode, Provider Diagnostics, Persistence, and Frontend UI).

### C. Database Backup & Restore Runbook
```powershell
# Create timestamped backup with SHA-256 digest
.\Production\scripts\backup_db.ps1 -ContainerName trustsense-staging-postgres

# Restore database with mandatory SHA-256 checksum verification
.\Production\scripts\restore_db.ps1 -BackupFile .\Production\backups\<backup_file>.dump -ContainerName trustsense-staging-postgres
```
*Note: Tampered backup files or mismatched SHA-256 checksums are deterministically rejected with exit code 1.*

### D. Teardown Staging Environment
```bash
docker compose -f Production/docker/docker-compose.staging.yml down
```

---

## 4. Production Deployment & Cloud Target (Phase 15 Verified)

### A. Environment Configuration
```bash
# Copy production environment variables template
cp Production/config/production.env.example Production/config/.env.production

# Generate and set 32-byte JWT secret
openssl rand -hex 32
```

### B. Automated Zero-Downtime Deployment
```bash
# Execute automated production deployment script
./Production/deployment/deploy_docker.sh
```
Or orchestrate manually:
```bash
# Build and launch production containers (Nginx, Backend, Frontend, Thermal AI, PostgreSQL)
docker compose -f Production/docker/docker-compose.prod.yml up -d --build

# Verify container health
docker compose -f Production/docker/docker-compose.prod.yml ps
```
In the production topology:
- **Nginx Reverse Proxy:** Exposed on ports `80` (redirect) and `443` (TLS 1.3).
- **Backend API (`3001`), Frontend UI (`3000`), Thermal AI (`8000`), PostgreSQL (`5432`):** Strictly internal to `eculytics-prod-net` with zero public host port exposition.
```

---

## 5. Security Hardening & Provider Posture (Phase 12 Verified)

### A. AWS S3 Evidence Storage
- **Identity Posture:** Dedicated IAM role `arn:aws:iam::218733195047:role/TrustSenseEvidenceStorageRole` assumed by service user `trustsense-s3-app`. **Root account usage is completely removed from application storage operations.**
- **Least-Privilege Policy:** Access is restricted strictly to `trustsense-evidence-218733195047-ap-south-1` (listing bucket & PutObject/GetObject/DeleteObject). Zero permissions for IAM, bucket deletion, or foreign resources.
- **Bucket Hardening:** Block Public Access (all 4 settings enabled), `BucketOwnerEnforced` (ACLs disabled), default SSE-S3 AES256 encryption.
- **Truthful Degradation:** When session credentials expire, the storage adapter honestly marks `LOCAL_S3_COMPATIBLE` with category `INVALID_OR_EXPIRED_CLIENT_TOKEN` and never fabricates live AWS success.

### B. Razorpay Payment Gateway
- **Mode:** Test Mode verified via genuine live orders created through Razorpay API.
- **Cryptographic Security:** Timing-safe HMAC-SHA256 signature verification (`crypto.timingSafeEqual`) prevents timing side-channel attacks.
- **Webhook Hardening:** Webhook signatures verified against raw request bodies. Handlers are strictly idempotent (duplicate webhooks do not duplicate invoices).
- **Production Transition:** Requires switching `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` from `rzp_test_` to `rzp_live_` merchant credentials.

### C. Hyperledger Fabric Blockchain Provenance
- **Topology:** Hyperledger Fabric v2.5 development network running locally on WSL 2 / Docker.
- **Channel & Chaincode:** Channel `bmschannel`, chaincode `trustsense-provenance` (Go CCaaS).
- **On-Chain Verification:** Official `@hyperledger/fabric-gateway` SDK submits real transactions (64-character hex TxIDs committed at block #101) and evaluates RFC 6962 inclusion proofs directly against the ledger state.
- **Anti-Tamper Protections:** Tampered record hashes, tampered sibling hashes, and inverted proof positions are strictly rejected by the on-chain smart contract.

### D. Production Deployment Blockers vs Development Requirements
- **JWT Secret:** Development allows fallback placeholder. Production mode (`NODE_ENV=production`) **strictly requires** a cryptographically strong secret $\ge 32$ characters without placeholders; weak secrets throw fatal startup errors.
- **AWS Workload Roles:** In production containers, `AWS_PROFILE` is omitted so the AWS SDK automatically utilizes the instance/container metadata workload role (`TrustSenseEvidenceStorageRole`). Direct S3 permissions have been completely stripped from the development user.
- **Advisory Scope:** TrustSense-BMS is strictly a decision-support, thermal intelligence, and cryptographic provenance platform. It does not issue physical actuator commands or override BMS safety interlocks.

---

## 6. Production Architecture Specification
For comprehensive architectural specifications, disaster recovery runbooks, and multi-organization consortium planning, consult:
- **[DEPLOYMENT_ARCHITECTURE.md](./DEPLOYMENT_ARCHITECTURE.md)** — Complete enterprise architecture, process supervision, WAL archiving, ML artifact delivery, and blue-green rollback playbook.
- **[config/production.env.example](./config/production.env.example)** — Validated production environment variable template.
- **[config/staging.env](./config/staging.env)** — Validated staging release candidate configuration.
- **[config/nginx.conf](./config/nginx.conf)** — Production SSL termination, HSTS, and reverse proxy routing.
- **[docker/docker-compose.staging.yml](./docker/docker-compose.staging.yml)** — Validated loopback staging compose configuration.
- **[docker/docker-compose.prod.yml](./docker/docker-compose.prod.yml)** — Production container orchestration topology.


