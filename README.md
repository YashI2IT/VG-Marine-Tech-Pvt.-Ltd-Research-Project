# ECUlytics & TrustSense-BMS

> **Enterprise Battery Thermal Intelligence, Virtual Sensing & Cryptographic Provenance Platform**  
> Developed for **VG Marine Tech Pvt. Ltd** | Academic & Scientific Alignment: **IEEE ESCI-2027**

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

## 3. Directory Structure

```
VG Marine Tech Pvt. Ltd Research Project/
├── backend/                              # Express + TypeScript API Server
│   ├── src/
│   │   ├── api/                          # REST API Route Handlers
│   │   │   ├── admin.ts                  # Admin operations (stats, user pool, traffic, billing)
│   │   │   ├── auth.ts                   # Login, register, logout, session /me
│   │   │   ├── dashboard.ts              # Fleet overview, thermal risk, anomalies
│   │   │   └── virtual-sensor.ts         # ML model prediction & MAT file handler
│   │   ├── db/                           # Drizzle ORM schema & database connection
│   │   ├── middleware/                   # JWT authentication guards
│   │   └── index.ts                      # Server entry point, request logger, error handling
│   ├── data/                             # Persistent data storage (users.json)
│   ├── .env.example                      # Backend environment template
│   ├── package.json                      # Backend dependencies & scripts
│   └── tsconfig.json                     # TypeScript compiler configuration
│
├── frontend/                             # Next.js 16 Web Application (App Router)
│   ├── src/
│   │   ├── app/                          # Next.js App Router Pages
│   │   │   ├── (app)/                    # Authenticated Layout (AppShell)
│   │   │   │   ├── admin/                # Administration Suite
│   │   │   │   │   ├── page.tsx          # Master Admin Hub (KPI tiles, quick actions)
│   │   │   │   │   ├── traffic/          # Telemetry Ingress & User Activity
│   │   │   │   │   ├── users/            # User Pool Management & Role Assignment
│   │   │   │   │   ├── maintenance/      # Fleet Battery Service & Work Orders
│   │   │   │   │   └── billing/          # Invoices, Quotas & Blockchain Ledger
│   │   │   │   ├── dashboard/            # Executive Thermal Overview
│   │   │   │   ├── virtual-sensor/       # Live Model Inference Bench
│   │   │   │   ├── fleet/                # Commercial Fleet Telemetry
│   │   │   │   ├── thermal-intelligence/ # Hotspot analysis, cooling, aging, forecast
│   │   │   │   └── maintenance/          # Work order tracking
│   │   │   ├── login/                    # Sign-in page
│   │   │   ├── register/                 # User registration page
│   │   │   └── forgot-password/          # Password recovery
│   │   ├── components/                   # Reusable UI, Charts, Heatmaps & Layout
│   │   └── services/                     # Typed API client services
│   ├── .env.example                      # Frontend environment template
│   └── package.json                      # Next.js dependencies & scripts
│
├── models/                               # Machine Learning & AI Virtual Sensor
│   ├── virtual_sensor/                   # Virtual sensor API & inference scripts
│   ├── cnn_lstm_battery_temperature.keras# Trained Neural Network weights
│   └── wykht8y7tg-1/                     # Panasonic 18650PF experimental battery dataset
│
├── ESCI_2027_TrustSenseBMS_Review/       # Research Paper Package (IEEE ESCI-2027)
│   ├── 06_Manuscript_Skeleton_IEEE/      # LaTeX manuscript (main.tex, references.bib)
│   ├── 07_Proposed_Figures/              # Figure blueprints & Mermaid specifications
│   └── 02_Verified_Literature_Matrix.csv # Curated 20-paper peer-reviewed evidence matrix
│
├── Documents/                            # Architecture blueprints & internship handbooks
├── tools/                                # Utility & maintenance scripts
├── start.bat                             # One-click startup script for Windows
├── stop.bat                              # One-click service shutdown script
├── status.bat                            # Instant health check script
├── package.json                          # Root package management
└── README.md                             # Master project documentation
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

## 7. Research Paper Alignment (IEEE ESCI-2027)

The project codebase directly aligns with our research publication for the **9th IEEE International Conference on Emerging Smart Computing and Informatics (ESCI-2027)**:

* **Title**: *“A Critical Review of Deep Learning-Based Virtual Temperature Sensing for Lithium-Ion Batteries: CNN–LSTM Models, Trust-Aware Data Validation, and Data Provenance”*
* **Submission Deadline**: October 15, 2026
* **Manuscript**: Located in [`ESCI_2027_TrustSenseBMS_Review/06_Manuscript_Skeleton_IEEE/main.tex`](ESCI_2027_TrustSenseBMS_Review/06_Manuscript_Skeleton_IEEE/main.tex)
* **Verified Evidence Base**: Strictly 20 peer-reviewed reference studies `[1]–[20]` detailing experimental thermal estimation, cyber-defense against False Data Injection Attacks (FDIA), and Hyperledger Fabric Merkle root complexity.

---

## 8. License & Intellectual Property

(c) 2026 **VG Marine Tech Pvt. Ltd**. All rights reserved.  
Proprietary software developed for marine and automotive battery management systems.
