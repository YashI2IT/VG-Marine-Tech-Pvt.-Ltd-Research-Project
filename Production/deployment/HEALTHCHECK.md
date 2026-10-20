# Production Healthcheck & Monitoring Runbook

## Liveness Probes
- **Backend API Gateway:** `GET http://localhost:3001/health` -> Expects HTTP 200 with `{"status":"ok"}`
- **Root Status Info:** `GET http://localhost:3001/` -> Expects HTTP 200 with platform metadata
- **Frontend App:** `GET http://localhost:3000/login` -> Expects HTTP 200

## SLA Metrics
- **API Response Latency:** < 50ms p95
- **Virtual Sensor Inference Latency:** < 450ms (for 60-step UDDS drive-cycle window)
- **Target Availability:** 99.95% uptime
