# ECUlytics & TrustSense-BMS

> **Enterprise Battery Thermal Intelligence, Virtual Sensing & Cryptographic Provenance Platform**  
> Developed for **VG Marine Tech Pvt. Ltd** 

---

## 1. Executive Summary

**ECUlytics & TrustSense-BMS** is a next-generation battery thermal management system (BTMS) designed to eliminate hardware thermistor blind spots in lithium-ion energy storage and electric marine/commercial fleets. 

By combining **deep learning virtual temperature sensing (hybrid 1D-CNN + LSTM)** with **trust-aware telemetry validation (5-$\sigma$ out-of-distribution bounds)** and **cryptographic provenance (SHA-256 Merkle root anchoring to Hyperledger Fabric)**, the platform delivers verifiable, tamper-proof thermal estimation across dynamic drive cycles and sub-zero climatic extremes.

---

## 2. Platform Architecture

```
+-----------------------------------------------------------------------------------------+
|                                    ECUlytics Platform                                   |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|   +-----------------------+     REST API / JWT     +--------------------------------+   |
|   |  Next.js 16 Frontend  | <====================> |   Node/Express API Gateway     |   |
|   |  - User Workspace     |   (Port 3000 -> 3001)  |   - Auth & Session Service     |   |
|   |  - Admin Dashboard    |                        |   - Dashboard Fleet Metrics    |   |
|   |  - Tailwind CSS v4    |                        |   - Admin Operations API       |   |
|   +-----------------------+                        +--------------------------------+   |
|                                                                    |                    |
|                                                                    v                    |
|   +---------------------------------------------------------------------------------+   |
|   |                           Virtual Sensing & ML Engine                           |   |
|   |   - Python PyTorch / Keras CNN-LSTM Estimator (`models/virtual_sensor/`)        |   |
|   |   - Input: Terminal Voltage, Current, Accumulated Ah, Ambient Temp              |   |
|   |   - Output: Virtual Core/Surface Temperature (MAE < 0.42 C on UDDS/WLTP)        |   |
|   +---------------------------------------------------------------------------------+   |
|                                            |                                            |
|                                            v                                            |
|   +---------------------------------------------------------------------------------+   |
|   |                     Trust & Cryptographic Provenance Layer                      |   |
|   |   - 5-Sigma Statistical Out-of-Distribution (OOD) Filter                        |   |
|   |   - Physics Residual Plausibility Bounds vs Electro-Thermal Model               |   |
|   |   - SHA-256 Merkle Tree Hash Aggregation -> Hyperledger Fabric Ledger          |   |
|   +---------------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------------+
```

---

## 3. Repository Architecture & Directory Structure

```
VG Marine Tech Pvt. Ltd Research Project/
├── 1) Production/                        # Enterprise Deployment & Release Engineering
│   ├── config/                           # Production Nginx reverse-proxy & environment templates
│   ├── docker/                           # Multi-stage Dockerfiles (backend & frontend) & docker-compose
│   ├── deployment/                       # Systemd daemons, automated deploy.sh & health runbooks
│   └── README.md                         # Production operations & scaling guide
│
├── 2) Integration/                       # End-to-End Testing & Cross-Service Contracts
│   ├── contracts/                        # OpenAPI 3.1 specification (api-contract.json)
│   ├── e2e/                              # Virtual sensor inference & telemetry pipeline E2E tests
│   ├── postman/                          # Automated API test collections for QA
│   ├── scripts/                          # Automated run_integration_tests.py test runner
│   └── README.md                         # Integration test documentation & guidelines
│
├── 3) Development/                       # Core Application Workspace (Frontend & Backend)
│   ├── frontend/                         # Next.js 16 Web Application (Arcana Auth, Admin Hub, Telemetry)
│   ├── backend/                          # Express + TypeScript API Gateway (Port 3001)
│   ├── docs/                             # Developer onboarding (LOCAL_SETUP.md & API_REFERENCE.md)
│   └── README.md                         # Development workspace guidelines & contribution standards
│
├── 4) Testing/                           # Unit Testing & Database Management Verification
│   ├── unit/                             # Algorithm boundary checks, 5-sigma OOD & auth validation
│   ├── db_management/                    # DB schema validations, migration tests & user persistence
│   ├── fixtures/                         # Mock battery telemetry packets & sample user profiles
│   ├── scripts/                          # Automated run_unit_tests.py test runner
│   └── README.md                         # Testing manifesto & coverage criteria
│
├── package.json                          # Workspace orchestration & npm script targets
├── .gitignore                            # Git exclusion rules
└── README.md                             # Master project overview & documentation
```

---

---

## 4. Getting Started & Full Clone Setup

Follow these exact steps to set up and run the platform on any machine cloned from GitHub.

### Prerequisites
* **Node.js**: v20+ (recommended v22 or v26)
* **npm**: v10+
* **PostgreSQL**: 16+ running locally on port 5432
* **Python**: 3.10+ (optional, for the CNN-LSTM PyTorch inference microservice)

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/YashI2IT/VG-Marine-Tech-Pvt.-Ltd-Research-Project.git
cd "VG-Marine-Tech-Pvt.-Ltd-Research-Project"
```

---

### Step 2: Configure Environment Files

#### 1. Backend Environment:
Copy the backend environment template:
```bash
# On Linux / macOS / Bash:
cp Development/backend/.env.example Development/backend/.env

# On Windows PowerShell:
Copy-Item Development/backend/.env.example Development/backend/.env
```
Ensure your PostgreSQL credentials in `Development/backend/.env` match your local PostgreSQL server:
```env
PORT=3001
FRONTEND_URL=http://localhost:3000
JWT_SECRET=trustsense_production_secure_secret_key_marine_2026_at_least_32_chars
DATABASE_URL=postgres://postgres:your_postgres_password@localhost:5432/eculytics
THERMAL_AI_URL=http://127.0.0.1:8000
STORAGE_MODE=auto
```

#### 2. Frontend Environment:
Copy the frontend environment template:
```bash
# On Linux / macOS / Bash:
cp Development/frontend/.env.example Development/frontend/.env.local

# On Windows PowerShell:
Copy-Item Development/frontend/.env.example Development/frontend/.env.local
```
The defaults in `.env.local` connect cleanly to the backend:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_TrCDSDp624RAOG
```

---

### Step 3: Setup the PostgreSQL Database

Create the `eculytics` database in PostgreSQL:
```bash
# Using PostgreSQL command line:
psql -U postgres -c "CREATE DATABASE eculytics;"

# Or using createdb:
createdb -U postgres eculytics
```

> **Automatic Schema Migration & Seeding:**
> You do **not** need to run manual SQL migration scripts. When the backend starts, its `initDb()` routine automatically creates all required tables (`users`, `tenants`, `vehicles`, `work_orders`, `subscriptions`, `telemetry_records`, `ledger_anchors`, etc.) and seeds default administrator and fleet records.

---

### Step 4: Install Dependencies

From the project root:
```bash
# Install backend dependencies
cd Development/backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ../..
```

---

### Step 5: (Optional) Python CNN-LSTM AI Inference Microservice

If you wish to run the real-time PyTorch CNN-LSTM virtual thermal sensor server:
```bash
cd Inference
pip install -r requirements.txt
python -m uvicorn thermal_ai:app --host 0.0.0.0 --port 8000
```
*(Note: If the Python service is offline, the backend automatically transitions to local physics-based thermal heuristics without throwing errors).*

---

### Step 6: Start the Application

You can start both services from the root or in separate terminal windows:

#### Terminal 1: Backend API Gateway (Port 3001)
```bash
cd Development/backend
npm run dev
```
*Console output will confirm:*
`[PostgreSQL] Connected to 'eculytics' as 'postgres'`
`[API Gateway] Listening on http://localhost:3001`

#### Terminal 2: Next.js Frontend (Port 3000)
```bash
cd Development/frontend
npm run dev
```
*Frontend will launch on:* **`http://localhost:3000`**

---

### Step 7: Verify Everything with the Automated Test Suite

To verify that your database, authentication, traffic tracker, and admin dashboards are functioning with 100% genuine data:
```bash
cd Development/backend
npm test
```
All **14 test suites** (including core validation, telemetry contracts, Merkle proofs, and admin dashboard gates) will execute and report 100% pass rate.

---

## 5. Default Credentials

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin@eculytics.com` | `password123` | Full Admin Console (`/admin`) + Workspace |
| **Fleet Operator** | `user@vgmarine.com` | `password123` | Fleet Workspace, Vehicles & Reports |
| **New Account** | *Self-register* | *Custom* | Instant self-onboarding at [/register](http://localhost:3000/register) |

---

## 6. Key URLs & Endpoints

| Resource | URL | Access Level |
| :--- | :--- | :--- |
| **Web Application** | `http://localhost:3000` | Landing & Workspace |
| **User Registration** | `http://localhost:3000/register` | Public Account Creation |
| **Login** | `http://localhost:3000/login` | Public Authentication |
| **Dashboard** | `http://localhost:3000/dashboard` | Authenticated Fleet Workspace |
| **Virtual Sensor** | `http://localhost:3000/virtual-sensor` | AI Inference Laboratory |
| **Admin Hub** | `http://localhost:3000/admin` | Administrative Control Center (Admin only) |
| **User Traffic** | `http://localhost:3000/admin/traffic` | Real Rolling-Window Request Telemetry |
| **User Pool** | `http://localhost:3000/admin/users` | Multi-Tenant User Management |
| **Maintenance Ops** | `http://localhost:3000/admin/maintenance` | Fleet Battery Packs & Live Probes |
| **Billing & Ledger** | `http://localhost:3000/admin/billing` | Quotas, Invoices & Blockchain Ledger |
| **Backend Health** | `http://localhost:3001/health` | Service Liveness Probe |
| **Backend Root** | `http://localhost:3001/` | Gateway Metadata & Route Index |

---

## 8. License & Intellectual Property

(c) 2026 **VG Marine Tech Pvt. Ltd**. All rights reserved.  
Proprietary software developed for marine and automotive battery management systems.
