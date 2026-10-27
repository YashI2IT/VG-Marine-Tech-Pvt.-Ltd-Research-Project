# TrustSense-BMS — Project Context

Last audited: 22 October 2026 (this session). Previous IDE reports and `TRUSTSENSE_VERIFICATION_REPORT.md` were not treated as proof.

TrustSense-BMS is the battery thermal intelligence stack inside the ECUlytics workspace. It is **advisory only**: it must not command contactors, cooling hardware, or any other battery actuator. Measured cell temperature (`battery_temp_degC`) is a held-out evaluation target and must never be a model input.

---

## 1. Architecture (as implemented)

```
Physical BMS / gateway          Panasonic 18650PF .mat replay
  HTTP ingest | MQTT | serial           (labeled SIMULATION)
        │                                      │
        ▼                                      ▼
  Telemetry contract (units, timestamps, Ah policy)
        │
        ▼
Express shared pipeline :3001
  TrustValidator ── BLOCK → quarantined_records (never inferred)
  60 consecutive SAFE/SUSPICIOUS steps
        ▼
  POST {THERMAL_AI_URL}/api/predict/window   (6 features only)
        ▼
  SHA-256 → telemetry_records (device_id, data_source)
  Merkle batch / local evidence / local ledger adapter
        ▼
Next.js /virtual-sensor
  Live Device  |  Dataset Replay  |  Offline MAT
```

Packet format and env vars: `Development/docs/TELEMETRY_CONTRACT.md`.

The ECUlytics fleet UI (dashboard, thermal-intelligence hubs, vehicles, reports) is a **separate product surface**. Most of those pages still read `src/data/mock.ts` and are not wired to the TrustSense pipeline.

---

## 2. Important directories

| Path | Role |
|---|---|
| `Development/backend/src/` | Express gateway: auth, dashboard (static JSON), admin, virtual-sensor upload, TrustSense pipeline |
| `Development/backend/src/simulation/engine.ts` | Panasonic/synthetic dataset replay feeder |
| `Development/backend/src/pipeline/processor.ts` | Shared trust → 60-step → CNN-LSTM → Merkle → SSE path |
| `Development/backend/src/telemetry/contract.ts` | Physical packet contract and derivations |
| `Development/backend/src/acquisition/` | HTTP (always), MQTT, optional serial adapters |
| `Development/docs/TELEMETRY_CONTRACT.md` | Device packet format and connection guide |
| `Development/backend/src/trust/validator.ts` | Cyber/physics plausibility |
| `Development/backend/src/provenance/merkle.ts` | RFC 6962 Merkle + canonical SHA-256 |
| `Development/backend/src/blockchain/ledger.ts` | Local PostgreSQL ledger adapter |
| `Development/backend/src/cloud/storage.ts` | Local evidence files under `uploads/evidence/` |
| `Development/backend/src/db/` | Drizzle schema + `CREATE TABLE IF NOT EXISTS` bootstrap |
| `Development/frontend/src/app/(app)/virtual-sensor/` | Live TrustSense dashboard |
| `Development/frontend/src/data/mock.ts` | Demo fleet data used by most other pages |
| `models/` | **Gitignored.** Local CNN-LSTM artifacts, FastAPI service, Panasonic `.mat` dataset |
| `chaincode/provenance/provenance.go` | Fabric chaincode source (not deployed here) |
| `Integration/scripts/test_trustsense_pipeline.js` | 10-phase live pipeline test (needs all three processes + Postgres) |
| `Testing/` | Lightweight fixture/script checks (not Jest/pytest for the Node pipeline) |
| `Production/docker/` | Compose for Postgres, inference, backend, frontend. No Fabric or SQS services |

---

## 3. Setup commands

Prerequisites: Node 20+, Python 3.10+, PostgreSQL 16+ with a database named `eculytics`.

```bat
copy Development\backend\.env.example Development\backend\.env
REM Set DATABASE_URL to a working local Postgres URL. Do not commit .env.
cd Development\backend && npm install
cd ..\frontend && npm install
```

Python extras (inference): TensorFlow/Keras, FastAPI, uvicorn, numpy, pandas, scikit-learn, joblib, scipy.

Start all three processes:

```bat
.\start.bat
```

Or separately:

```bat
python models\inference_service.py
npm run dev:backend
npm run dev:frontend
```

Default URLs: frontend `http://localhost:3000`, gateway `http://localhost:3001`, inference `http://localhost:8000/health`. Live lab: `http://localhost:3000/virtual-sensor`.

Demo logins (seeded on first successful login if the users table is empty): `admin@eculytics.com` / `password123`, `user@vgmarine.com` / `password123`.

---

## 4. Environment variables

Templates: `.env.example`, `Development/backend/.env.example`. `.env` is gitignored.

| Variable | Used by | Notes |
|---|---|---|
| `PORT` | Backend | Default `3001` |
| `FRONTEND_URL` | Backend CORS | Default `http://localhost:3000` |
| `DATABASE_URL` | Backend | **Required.** Process throws if missing. |
| `THERMAL_AI_URL` | Backend | Default `http://127.0.0.1:8000`. Required in Docker (`http://thermal-inference:8000`) |
| `JWT_SECRET` | Auth | Falls back to a hardcoded dev string if unset |
| `FABRIC_CHANNEL`, `FABRIC_CHAINCODE` | Ledger adapter labels | |
| `FABRIC_PEER_ENDPOINT` | Flips `networkType` label only | Does **not** call a Fabric SDK |
| `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Storage adapter | Detected but **S3 PutObject is not implemented** |
| `NEXT_PUBLIC_API_URL` | Frontend | Default `http://localhost:3001` (`/api` is appended in `lib/api.ts`) |
| `TELEMETRY_TRANSPORT` | Backend | `http` (always on), plus optional `mqtt` and/or `serial` |
| `TELEMETRY_DEVICE_ID` | Backend | Fallback device id if the packet omits one |
| `TELEMETRY_INGEST_TOKEN` | Backend | Optional `X-Telemetry-Token` for HTTP ingest. Never send from the browser. |
| `TELEMETRY_STALE_MS`, `TELEMETRY_MAX_GAP_S` | Backend | Stale packet and non-consecutive window reset |
| `TELEMETRY_AH_SOURCE`, `TELEMETRY_AH_INITIAL` | Backend | `payload` (default) or `integrate` coulomb-count |
| `MQTT_BROKER_URL`, `MQTT_TOPIC`, `MQTT_USERNAME`, `MQTT_PASSWORD` | Backend | MQTT adapter; adapter stays idle if broker URL is empty |
| `TELEMETRY_SERIAL_PATH`, `TELEMETRY_SERIAL_BAUD` | Backend | Optional USB/UART. Requires `serialport` package |

There is **no SQS / async job worker** in this repository despite schema tables `processing_jobs` and `dataset_versions`.

---

## 5. API endpoints

### Gateway (`:3001`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Platform metadata |
| GET | `/health` | Process liveness only (does not probe Postgres or the model) |
| POST | `/api/auth/login`, `/register`, `/logout` | JWT cookie auth |
| GET | `/api/auth/me` | Current user |
| GET | `/api/dashboard/*` | Hard-coded fleet JSON (not live telemetry) |
| GET/POST | `/api/admin/*` | Admin stats/users; some metrics are static |
| POST | `/api/virtual-sensor/predict` | Offline `.mat` upload → Python `predict_api.py` |
| GET | `/api/virtual-sensor/latest` | Last offline result |
| GET | `/api/trustsense/status` | Sim, pipeline, acquisition, model health, ledger/storage, Postgres counts |
| GET | `/api/trustsense/cycles` | Proxy to inference dataset listing |
| POST | `/api/trustsense/simulation/control` | `start` / `pause` / `stop` / `reset` / `speed` / `cycle` |
| GET | `/api/trustsense/simulation/stream` | SSE live telemetry |
| POST | `/api/trustsense/simulation/anomaly` | Inject voltage/current/power/NaN test fault |
| GET | `/api/trustsense/provenance/batches` | Recent Merkle batches + anchors |
| GET | `/api/trustsense/provenance/verify/:recordId` | Recompute hash + Merkle proof |
| POST | `/api/trustsense/provenance/tamper_test` | Off-chain tamper demo (does not mutate DB) |
| GET | `/api/trustsense/evidence/:batchId` | Local evidence JSON |
| GET | `/api/trustsense/passport/:batteryId` | Battery passport row |
| GET | `/api/trustsense/quarantine` | Blocked samples |
| POST | `/api/trustsense/telemetry/ingest` | Physical JSON packet (read-only) |
| GET | `/api/trustsense/telemetry/status` | Device connection, transports, last packet |

### Inference (`:8000`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Model loaded, window length 60, target column name |
| GET | `/api/model/info` | Scaler stats and reported MAE/RMSE |
| GET | `/api/dataset/cycles` | Discover `.mat` drive cycles |
| GET | `/api/dataset/load_cycle` | Replay records including held-out `battery_temp_degC` |
| POST | `/api/predict/window` | Exactly 60 steps × 6 features. Reference temp is optional and residual-only |

---

## 6. Model details

- Artifacts (local, gitignored): `models/cnn_lstm_battery_temperature_zipped.keras`, `feature_scaler.pkl`, `target_scaler.pkl`.
- Architecture (saved Keras graph): Conv1D → LSTM(64, return_sequences) → LSTM(32) → Dense(32) → Dropout(0.2) → Dense(1).
- Input shape: `(60, 6)` with feature order `voltage_v`, `current_a`, `ah`, `chamber_temp_degC`, `power_w`, `current_abs_a`.
- Target: `battery_temp_degC`. Window request schema does not accept that field; `target_leakage_prevented` is true only when forbidden columns are absent from the window frame.
- Dataset: Panasonic NCR18650PF `.mat` under `models/wykht8y7tg-1/`. Default replay cycle `03-27-17_09.06 10degC_UDDS_Pan18650PF.mat`.
- If inference is down, the simulation engine **falls back to a synthetic sine drive cycle** so the UI still moves. Those numbers are not Panasonic measurements.

---

## 7. Data flow (actual)

**Physical live device (HTTP always; MQTT/serial if configured):** JSON packet → contract (`normalizeIncoming`) → exclusive lock vs dataset replay → TrustValidator → 60 consecutive admitted steps → FastAPI window predict → SHA-256 / Merkle / local evidence / local ledger adapter → SSE `LIVE_TELEMETRY` with `dataSource: LIVE_DEVICE`.

**Dataset replay:** Panasonic `.mat` (or synthetic fallback if FastAPI is down) → same shared `TelemetryPipeline` → SSE with `dataSource: DATASET_REPLAY`. UI labels this as simulation.

Shared rules:

1. TrustValidator runs **before** the 60-step buffer.
2. `BLOCK` → `quarantined_records`, no inference, no Merkle leaf.
3. `SAFE` / `SUSPICIOUS` enter the buffer. Inference only at exactly 60 consecutive valid steps. Feature vector is the six trained columns; `battery_temp_degC` is residual-only.
4. Canonical JSON (sorted keys, 4 decimal places) → SHA-256 → `telemetry_records` (includes `device_id`, `data_source` when present).
5. Every 30 hashed records: RFC 6962 Merkle tree, local evidence JSON, PostgreSQL `ledger_anchors` (not a live Fabric peer).
6. `/virtual-sensor` has three modes: Live Device, Dataset Replay, Offline MAT. Live Device KPIs render only when `pipeline.activeSource === LIVE_DEVICE`.

---

## 8. What is implemented / tested / incomplete / planned

| Area | Status | Evidence |
|---|---|---|
| CNN-LSTM inference + scalers | Implemented locally | `models/` present; pytest 9 passed this run |
| Target isolation | Implemented | Window schema excludes target; live-window pytest asserts six features only |
| Physical ingest | Implemented in code | HTTP always; MQTT/serial adapters idle until env is set. **No physical BMS was connected this run** |
| Dataset replay | Implemented | Panasonic `.mat` if FastAPI is up; otherwise synthetic, labeled `SYNTHETIC_FALLBACK` |
| Trust gate + quarantine | Implemented | Voltage/current/power/`dV/dt`/`dI/dt` BLOCK |
| PostgreSQL persistence | Implemented in code | Not re-verified this run; last known `.env` URL failed auth |
| Merkle + tamper demo | Implemented | In-process crypto; independent of Fabric |
| Live Fabric network | Chaincode only | Local Postgres adapter. Do not treat `connected` as a live peer |
| AWS S3 | Not implemented | Local JSON evidence only |
| AWS SQS / async jobs | Planned only | No SQS code |
| `/virtual-sensor` | Implemented | Live Device / Dataset Replay / Offline MAT |
| Fleet dashboard / thermal hubs | Mixed | TrustSense strip uses `/api/trustsense/status`. Fleet/hotspot/cooling cards remain `mock.ts` |
| `npm run test:trustsense` | Exists | Not run — gateway, inference, and frontend were down |

---

## 9. Checks run this audit (genuine)

| Check | Result |
|---|---|
| `cd Development/backend && npx tsc --noEmit` | Exit 0 |
| `cd Development/frontend && npx tsc --noEmit` | Exit 0 |
| `cd Development/backend && npm test` (validator + telemetry contract + Merkle) | Exit 0 |
| `python -m pytest models/virtual_sensor/tests/` | 9 passed, sklearn warnings |
| `python Testing/scripts/run_unit_tests.py` | 4/4 fixture/script checks |
| `GET :3001/health` | Down |
| `GET :8000/health` | Down |
| `GET :3000/login` | Down |
| `npm run test:trustsense` | Not run (services down) |

Physical-device end-to-end inference was **not** executed: no BMS/MQTT broker/serial device was attached, and the inference process was not running.

---

## 10. Known issues

1. **Postgres URL in local `.env` does not authenticate.** Pipeline persistence and `test:trustsense` cannot succeed until `DATABASE_URL` matches the running cluster. Do not put the real password in git.
2. **Frontend not running this session.** `GET :3000/login` was down. An earlier session saw Swagger UI on that port.
3. **Gitignore of `models/`.** Weights, scalers, dataset, and `inference_service.py` are not in git. Clones cannot run thermal AI without a local copy.
4. **Ledger is a local adapter.** Status may say `connected` while `mode` is `LOCAL_DEV_NETWORK`. Do not treat that as a live Fabric peer.
5. **No S3 PutObject.** Evidence is local disk only.
6. **No SQS.** Cloud “asynchronous processing” is schema-only.
7. **Dashboard honesty.** Admin metrics and `/api/dashboard/*` mix live user counts with hard-coded fleet numbers. Thermal-intelligence pages are labeled as unimplemented.
8. **JWT_SECRET default** and demo passwords exist for local login seeding.
9. **`/health` is process-only.** A 200 does not mean Postgres or the model is up; use `/api/trustsense/status`.
10. **Offline virtual-sensor path** still shells out to `predict_api.py` independently of FastAPI.

---

## 11. Next priorities

1. Operator: put a working `DATABASE_URL` in untracked `Development/backend/.env`, start inference + backend + frontend, then `npm run test:trustsense`.
2. Operator: connect a real BMS/gateway (HTTP JSON, or MQTT/serial env) and confirm 60 consecutive samples produce CNN-LSTM output on Live Device. Not verified here.
3. Merkle unit tests independent of the live pipeline script — done (`npm run test:merkle`).
4. Dashboard TrustSense pipeline strip reads `/api/trustsense/status` (in-memory + Postgres counts when available). Demo fleet cards remain labeled demo.
5. Later, only with real credentials/network: Fabric Gateway SDK, S3 PutObject, SQS worker.
