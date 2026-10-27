# Production Healthcheck & Monitoring Runbook

## 1. Liveness & Readiness Probes

### A. API Gateway Liveness Probe
- **Endpoint:** `GET http://localhost:3001/health` (or `/health` via Nginx)
- **Expected Status:** HTTP 200 OK
- **Payload:** `{"status":"ok","uptime":<seconds>}`
- **Usage:** Container liveness check; triggers restart if process deadlocks.

### B. Deep Dependency Readiness Probe
- **Endpoint:** `GET http://localhost:3001/ready`
- **Expected Status:** HTTP 200 OK
- **Dependency Checks:**
  1. **PostgreSQL Connectivity:** `SELECT 1;` with query latency reporting (< 15ms target).
  2. **Virtual Thermal Sensor (CNN-LSTM):** `http://thermal-ai:8000/health` (< 50ms target).
  3. **AWS S3 Evidence Storage:** IAM workload identity verification & bucket target reachability.
  4. **Hyperledger Fabric Gateway:** Peer connectivity and channel status.
  5. **Razorpay Payment Gateway:** Mode verification (`RAZORPAY_TEST_MODE` / Live).

### C. ML Inference Service Health Probe
- **Endpoint:** `GET http://localhost:8000/health`
- **Expected Status:** HTTP 200 OK
- **Payload:** `{"status":"healthy","model_loaded":true}`

### D. Frontend Web App Probe
- **Endpoint:** `GET http://localhost:3000/` (or `https://eculytics.vgmarine.com/`)
- **Expected Status:** HTTP 200 OK with valid HTML5 document structure.

---

## 2. Operational SLA Metrics & Performance Targets
- **API Response Latency:** < 50ms p95 across metadata and telemetry routes.
- **Virtual Sensor Inference Latency:** < 250ms (for 60-step sliding window inference).
- **Database Query Latency:** < 10ms p95 for standard indexed tenant queries.
- **Target Availability:** 99.95% uptime.

---

## 3. Automated Monitoring & Alerting Triggers
- **Fatal Error Rate:** Alert if HTTP 5xx responses exceed 1% over a 5-minute rolling window.
- **Thermal Virtual Sensor Timeout:** Alert if inference latency exceeds 1000ms.
- **S3 Evidence Upload Failure:** Alert if `STORAGE_MODE=s3` fails or falls back to local storage.
- **Blockchain Ingestion Backlog:** Alert if unanchored batches exceed 5 batches.

