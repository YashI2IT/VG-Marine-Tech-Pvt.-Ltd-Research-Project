# Testing Suite & Database Management Verification

> **ECUlytics Quality Assurance, Unit Testing & DB Management**

---

## 1. Overview
The `Testing/` directory hosts unit tests, data fixtures, and database management verification scripts:
- **Unit Testing:** Algorithm boundary validation, JWT authentication logic, and error handlers.
- **DB Management Unit Testing:** Schema validation, migration integrity tests, and user persistence verifications.

## 2. Directory Structure
```
Testing/
├── unit/                    # Functional unit test suites
│   ├── auth_validation.test.ts # Input sanitization, password hashing & tokens
│   └── telemetry_bounds.test.ts# 5-sigma OOD boundary checks & residual physics
├── db_management/           # Database management unit tests
│   ├── schema_validation.test.ts # Database table schemas (users, vehicles, batteries)
│   └── db_migration.test.ts     # Migration consistency & JSON fallback store verification
├── fixtures/                # Mock datasets & test payloads
│   ├── mock_telemetry.json  # Sample battery pack voltage, current & temperature frames
│   └── mock_users.json      # Standard test user roles (admin, operator, viewer)
└── scripts/                 # Test runners
    └── run_unit_tests.py    # Automated test runner for unit & DB verification
```

## 3. Running Unit & DB Tests
```bash
python Testing/scripts/run_unit_tests.py
```
