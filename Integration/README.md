# Integration Testing & Service Contracts

> **ECUlytics & TrustSense-BMS Cross-Service Integration Suite**

---

## 1. Overview
The `Integration/` folder validates cross-system boundaries:
- Frontend Client $\leftrightarrow$ Backend API Gateway
- Backend API $\leftrightarrow$ Python ML Virtual Temperature Sensor Engine
- Telemetry Ingestion $\leftrightarrow$ 5-$\sigma$ OOD Statistical Validation & Data Provenance

## 2. Directory Structure
```
Integration/
├── contracts/               # Formal OpenAPI / REST schema definitions
│   └── api-contract.json    # OpenAPI 3.1 specification for all endpoints
├── e2e/                     # End-to-end integration workflows
│   └── virtual_sensor_pipeline.test.py # Dataset -> CNN-LSTM Inference -> Output
├── postman/                 # Automated API test collections
│   └── ECUlytics_API_Integration.postman_collection.json
└── scripts/                 # Automated test runners
    └── run_integration_tests.py # One-command end-to-end integration runner
```

## 3. Running Integration Tests
```bash
python Integration/scripts/run_integration_tests.py
```
