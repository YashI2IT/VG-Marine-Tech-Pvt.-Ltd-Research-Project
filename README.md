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

## 4. Getting Started

### Prerequisites
* **Node.js**: v20+ (tested with v26)
* **Python**: 3.10+ (for Virtual Sensor ML inference)
* **npm**: v10+

### Quick Start (Windows)
Double-click `start.bat` or run:
```cmd
.\start.bat
```
This automatically checks ports, starts the Backend API on `http://localhost:3001`, and launches the Next.js Frontend on `http://localhost:3000`.

### Manual Startup

#### 1. Backend API
```cmd
cd backend
npm install
npm run dev
```
*API will be available at [http://localhost:3001](http://localhost:3001)*

#### 2. Frontend Application
```cmd
cd frontend
npm install
npm run dev
```
*Web app will be available at [http://localhost:3000](http://localhost:3000)*

---

## 5. Default Credentials

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin@eculytics.com` | `password123` | Full Admin Panel + User Workspace |
| **Fleet Operator** | `user@vgmarine.com` | `password123` | User Workspace & Diagnostics |
| **New Account** | *Self-register* | *Custom* | Instant access via [/register](http://localhost:3000/register) |

---

## 6. Key URLs & Endpoints

| Resource | URL | Role |
| :--- | :--- | :--- |
| **Web Application** | `http://localhost:3000` | Landing & User Redirect |
| **User Registration** | `http://localhost:3000/register` | Public Account Creation |
| **Login** | `http://localhost:3000/login` | Public Authentication |
| **Dashboard** | `http://localhost:3000/dashboard` | Authenticated Fleet Workspace |
| **Virtual Sensor** | `http://localhost:3000/virtual-sensor` | AI Inference Laboratory |
| **Admin Hub** | `http://localhost:3000/admin` | Administrative Control Center |
| **User Traffic** | `http://localhost:3000/admin/traffic` | Telemetry & Load Analytics |
| **User Pool** | `http://localhost:3000/admin/users` | User Management & Access Control |
| **Maintenance Ops** | `http://localhost:3000/admin/maintenance` | Fleet Service & Sensor Calibration |
| **Billing & Ledger** | `http://localhost:3000/admin/billing` | Quotas, Invoices & Blockchain Ledger |
| **Backend Health** | `http://localhost:3001/health` | Service Liveness Probe |
| **Backend Root** | `http://localhost:3001/` | Gateway Metadata & Route Index |

---

## 8. License & Intellectual Property

(c) 2026 **VG Marine Tech Pvt. Ltd**. All rights reserved.  
Proprietary software developed for marine and automotive battery management systems.
