# TrustSense-BMS Product Stabilization Matrix

**Document Purpose:** Living, authoritative tracking of section-by-section product stabilization for the TrustSense-BMS & ECUlytics platform prior to public or cloud deployment.

**Policy Directives:**
- **Zero Cloud Deployment:** No provisioning of paid cloud infrastructure, DNS changes, Razorpay Live Mode activation, or external public exposure during this phase.
- **Section-by-Section Focus:** One application section is stabilized, tested, and verified at a time.
- **Truthful Status Labels:** Never label a section `STABLE` solely because TypeScript compiles or a page renders.
- **Strict Data Integrity:** Eliminate mock, hard-coded, or fabricated data from production-facing flows.

---

## Baseline Verification Record (Phase D Baseline)

| Component | Status | Details / Metrics |
| :--- | :--- | :--- |
| **PostgreSQL Database** | ✅ Operational | Port 5432 running locally. All 20 schema tables initialized and verified. |
| **Hyperledger Fabric v2.5** | ✅ Operational | Local development consortium (`peer0.org1.example.com:7051`, `orderer.example.com:7050`, `ca.org1.example.com:7054`, `trustsense-chaincode:9999`, `trustsense-fabric-cli`). |
| **Backend TypeScript Build** | ✅ Clean (0 Errors) | `npm run build` in `Development/backend` completed with exit code 0. |
| **Frontend Turbopack Build** | ✅ Clean (0 Errors) | `npm run build` in `Development/frontend` completed with exit code 0 (31 routes compiled). |
| **Backend Regression Test Suite** | ✅ 100% Pass (14/14) | `npm test` passed all 14 test suites (Validator 10/10, Telemetry 14/14, Merkle 8/8, Pipeline 15/15, Billing 9/9, Fleet & Reports 14/14, Thermal 16/16, External 17/17, Acceptance 67/67, Razorpay 21/21, S3 8/8, Fabric 10/10, Onboarding 10/10, Admin Dashboard 23/23). |
| **Admin Console & Operations** | ✅ Stabilized (100% Real DB) | All 5 Admin pages backed by genuine PostgreSQL data, zero mock data, zero fake delays, live diagnostics probe, and role security. |
| **Frontend Automated Tests** | ❌ Gaps Discovered | `Development/frontend` lacks automated Jest/Vitest/Playwright test suites in `package.json`. |

---

## Product Section Stabilization Matrix

### Status Legend
- `NOT AUDITED`: Section has not yet been systematically inspected.
- `AUDIT IN PROGRESS`: Code review, API tracing, and vulnerability analysis underway.
- `BLOCKED`: Blocked by external dependency or critical architectural defect.
- `FIX IN PROGRESS`: Concrete fixes are actively being authored for this section.
- `TESTING`: Fixes implemented; unit, integration, and UI verification in progress.
- `STABLE`: Fully integrated with database/APIs, no mock dependencies, verified security, tests passing.

---

### Section 1: Authentication, Login, Registration and Sessions
- **Status:** `TESTING`
- **Severity:** Medium
- **Frontend Files:**
  - `Development/frontend/src/app/login/page.tsx`
  - `Development/frontend/src/app/register/page.tsx`
  - `Development/frontend/src/app/forgot-password/page.tsx`
  - `Development/frontend/src/app/(app)/layout.tsx`
  - `Development/frontend/src/services/auth.ts`
  - `Development/frontend/src/lib/api.ts`
- **Backend/API Files:**
  - `Development/backend/src/api/auth.ts`
  - `Development/backend/src/middleware/auth.ts`
  - `Development/backend/src/middleware/rateLimiter.ts` (`authRateLimiter`)
- **Database Tables & Dependencies:** `users`, `tenants`, `tenant_users`. PBKDF2/Crypto, JWT, Cookie-Parser.
- **Current Behavior:** Real user registration, login, logout, and session check (`/auth/me`). Client layout redirects unauthenticated users to `/login`. Admin users are restricted to `/admin/*`; non-admins are restricted to `/dashboard/*`. Rate limiting protects brute-force attempts.
- **UI Modernization (White Theme):** Redesigned `AuthTransitionCard.tsx` with a minimalist, clean white card aesthetic (`max-w-[440px]`, glowing purple focus rings `focus:ring-indigo-100 focus:border-indigo-600`, vibrant purple CTA button `bg-[#6366f1]`, authentic Google SSO button, and seamless mode switching between `/login` and `/register`).
- **Mocked or Incomplete Areas:**
  - Forgot password endpoint stubbed (returns success message without dispatching SMTP email).
  - Lack of automated client-side auth error state tests.
- **Bugs, UX Inconsistencies & Security:**
  - Hardcoded redirect behavior in `layout.tsx` prevents admins from accessing user-facing operational pages (e.g. `/vehicles`, `/thermal-intelligence`).
- **Existing Tests:** Covered in `run_phase5_acceptance_checks.ts` and `run_staging_release_candidate_acceptance.ts`.
- **Missing Tests:** Automated token expiration/refresh tests, brute force threshold lockouts, email format edge cases.
- **Acceptance Criteria to Mark STABLE:**
  1. Login and registration verified against PostgreSQL users table.
  2. Rate limiting verifies lockout after 10 failed login attempts.
  3. Session cookies verify `HttpOnly`, `SameSite=Lax`, and secure path constraints.
  4. Role navigation rules documented and verified for admin, operator, and viewer roles.

---

### Section 2: Main Dashboard & Navigation
- **Status:** `STABLE`
- **Severity:** High
- **Frontend Files:**
  - `Development/frontend/src/app/(app)/dashboard/page.tsx` (Completely redesigned with 100% genuine data integration)
  - `Development/frontend/src/components/layout/AppShell.tsx` (Structured sticky header bar & breadcrumb)
  - `Development/frontend/src/components/layout/Sidebar.tsx` (Left-docked, sticky collapsible sidebar)
  - `Development/frontend/src/services/dashboard.ts` (Mock data removed; calls live `/api/dashboard`)
  - `Development/frontend/src/types/domain.ts` (Dynamic types for tenant, hotspots, cooling, sensors, and forecast)
- **Backend/API Files:**
  - `Development/backend/src/api/dashboard.ts` (100% genuine PostgreSQL & CNN-LSTM data; tenant-isolated via `req.user.tenantId`)
  - `Development/backend/src/middleware/auth.ts` (`requireOnboardingComplete` ensures token parsed before tenant verification)
  - `Development/backend/src/api/trustsense.ts` (`/status` pipeline telemetry overview)
- **Database Tables & Dependencies:** `vehicles`, `work_orders`, `telemetry_records`, `prediction_records`, `battery_passports`, `company_profiles`, `tenants`.
- **Current Behavior:** Displays authoritative fleet thermal health, vehicles at thermal risk, active anomalies, priority work orders, and CNN-LSTM virtual sensor inference. Zero mock dependencies remain in the production user dashboard flow. Strictly scoped to authenticated tenant ID (`req.user.tenantId`).
- **Complete UI Redesign & Data Integration Record:**
  - **100% Genuine Backend Integration:**
    - Replaced all static and fabricated constants with live PostgreSQL queries across `vehicles`, `work_orders`, `telemetry_records`, `prediction_records`, `battery_passports`, and `company_profiles`.
    - Removed `import { batteries } from "@/data/mock"` and `<DemoBanner />` from `dashboard/page.tsx`.
    - Removed `import { dashboardSummary } from "@/data/mock"` and hardcoded `demo: true` from `services/dashboard.ts`.
    - Server-side tenant scoping enforced on all routes (`/fleet`, `/thermal-risk`, `/anomalies`, `/hotspot-summary`, `/cooling-health`, `/sensor-health`, `/thermal-aging`, `/forecast`, `/maintenance`, `/`).
    - Verified strict tenant isolation: Tenant 1 sees 5 vehicles and 3 work orders; Tenant 5 (Sify) sees 0 vehicles and 0 work orders with an honest onboarding empty state; zero cross-tenant leakage.
  - **Scientific & Operational Accuracy:**
    - Distinctly separated measured thermocouple temperatures (`referenceTempDegC`, e.g. 27.8°C / 12.24°C) from CNN-LSTM virtual sensor estimates (`predictedTempDegC`, e.g. 18.29°C).
    - Distinctly separated measurement timestamps from dashboard fetch timestamps.
    - Reported actual model inference confidence (`LOW-CONFIDENCE` / `VALID`), residual (`-6.05°C`), and OOD envelope status (`IN-DISTRIBUTION`).
    - Explicitly documented the advisory platform boundary: "No direct physical actuator commands or battery contactor control signals are issued from this user interface."
    - Accurately designated Sensor Reduction as `PLANNED_RESEARCH` (laboratory optimization study; not active in production telemetry).
    - Replaced synthetic 4x4 spatial heatmaps with honest pack thermal distribution telemetry (`Tmax`, `Tavg`, `Tmin`, `ΔT`, `dT/dt`) and a clear policy notice: "Pack-level thermal telemetry active. Sub-module cell matrix requires individual thermocouple bus instrumentation."
  - **Enterprise UI Polish & Responsive Layout:**
    - Integrated ECUlytics branding: Deep navy (`#0f2744`), clean blue accents (`#2563eb`), subtle mint highlights (`#059669`), rose warnings (`#e11d48`), and neutral slate card surfaces (`#f8fafc`, `bg-white`).
    - Header: Streamlined sticky header bar cleanly displaying the active section pill on the left; removed redundant mock search bar, notification bell, and duplicate user dropdown pill from the header (user profile, role details, and sign out remain accessible via the left-docked sticky sidebar).
    - Header Greeting Hero Strip: Dynamic time-of-day greeting (`Good afternoon, Yash`), tenant pill (`VG Marine Tech Fleet Ops`), calendar pill, and interactive `Refresh` button with live spin animation.
    - Operational Status Strip (`TrustSense pipeline`): Real ingestion source badge (`LIVE_DEVICE`), model status, ledger status, admitted sample counts, and database record counters.
    - 4 Reconciled Fleet Overview KPIs: `Fleet thermal health` (3/5), `Vehicles at thermal risk` (2), `Active thermal anomalies` (2), `Urgent maintenance` (2).
    - Thermal Intelligence Grid: Highest-risk vehicle pack hotspot card (`V-1042`), cooling loop efficiency card (65% degraded on `V-1042`), sensor health card (1 faulty, 1 watch, 3 healthy), and interactive vehicles-at-risk list.
    - Predictive Analytics: Real CNN-LSTM trend line chart driven by persisted inference windows, 10-minute forecast horizon, and sparse sensor research card.
    - Maintenance & Events: Live work orders (`WO-9401` urgent, `WO-9402` high, `WO-9403` routine) and real recorded audit timeline.
    - Resilient UX States: Clean empty states for zero-vehicle organizations, zero open work orders, zero active anomalies, plus loading spinners and query retry triggers.
- **Verification Results:**
  - Backend TypeScript compilation (`npm run build` in `Development/backend`): 0 errors, Exit code 0.
  - Backend regression test suite (`npm test` in `Development/backend`): All 12 test suites passed (67/67 Phase 5 acceptance checks, Merkle tests, S3 storage tests, Fabric ledger tests).
  - Live authenticated API verification (`GET /api/dashboard` on port 3001): Status 200 OK; verified all fields match real PostgreSQL records.
  - Multi-tenant isolation test: Tenant 1 returns VG Marine Tech data; Tenant 5 returns Sify data with zero leakage.
  - Frontend Turbopack production build (`npm run build` in `Development/frontend`): 31/31 routes compiled cleanly, Exit code 0.
- **Acceptance Criteria to Mark STABLE:**
  1. [x] Remove all `@/data/mock` imports from `dashboard/page.tsx` and `services/dashboard.ts`.
  2. [x] Heatmap and hotspot data dynamically sourced from PostgreSQL `vehicles` and `prediction_records`.
  3. [x] `<DemoBanner />` removed and genuine live status indicators displayed.
  4. [x] Empty and loading states gracefully handle zero-vehicle fleets and zero-order queues.
  5. [x] Server-side tenant isolation strictly enforced on every dashboard endpoint.
  6. [x] Sensor reduction accurately labeled as `PLANNED_RESEARCH`.
  7. [x] Measured and predicted temperatures clearly distinguished with timestamps.

---

### Section 3: Fleet and Vehicle Management
- **Status:** `AUDIT IN PROGRESS`
- **Severity:** High
- **Frontend Files:**
  - `Development/frontend/src/app/(app)/fleet/page.tsx`
  - `Development/frontend/src/app/(app)/vehicles/page.tsx`
  - `Development/frontend/src/app/(app)/vehicles/[vehicleId]/page.tsx`
  - `Development/frontend/src/app/(app)/vehicles/[vehicleId]/battery/page.tsx`
  - `Development/frontend/src/app/(app)/vehicles/[vehicleId]/battery/[batteryId]/page.tsx`
  - `Development/frontend/src/services/fleet.ts`
  - `Development/frontend/src/services/vehicles.ts`
  - `Development/frontend/src/services/batteries.ts`
- **Backend/API Files:**
  - `Development/backend/src/api/vehicles.ts`
  - `Development/backend/src/api/trustsense.ts` (`/passport/:batteryId`)
- **Database Tables & Dependencies:** `vehicles`, `battery_passports`, `tenants`.
- **Current Behavior:** Full CRUD on `/api/vehicles` against PostgreSQL `vehicles` table with tenant boundary filtering.
- **Mocked or Incomplete Areas:**
  - `services/batteries.ts` is 100% mocked: imports `batteries` from `@/data/mock` and uses synthetic `delay()`.
  - `/vehicles/[vehicleId]/battery/page.tsx` and `[batteryId]/page.tsx` load battery data exclusively from `@/data/mock`.
  - Displays `<DemoBanner />` on battery drilldown pages.
  - Table `battery_passports` in PostgreSQL is not queried by the frontend battery views.
- **Bugs, UX Inconsistencies & Security:**
  - Adding a new vehicle in the UI cannot be inspected at the battery/cell level because mock batteries only exist for hardcoded IDs.
- **Existing Tests:** `run_fleet_reports_checks.ts` (vehicle CRUD, duplicate key rejection, tenant filtering).
- **Missing Tests:** Test suite for battery passport API query and pack hierarchy rendering.
- **Acceptance Criteria to Mark STABLE:**
  1. Wire `services/batteries.ts` to backend `/api/trustsense/passport/:batteryId` and PostgreSQL vehicle metrics.
  2. Remove `@/data/mock` import from `services/batteries.ts`.
  3. Verify vehicle creation, update, and deletion reflected immediately in UI and database.
  4. Ensure cross-tenant vehicle access attempts return 403 Forbidden.

---

### Section 4: Virtual Sensor & Telemetry Pipeline
- **Status:** `STABLE`
- **Severity:** High
- **Frontend Files:**
  - `Development/frontend/src/app/(app)/virtual-sensor/page.tsx` (Complete multi-state telemetry controls, dynamic 1Hz freshness ticker, live charts & trust decisions)
  - `Development/frontend/next.config.ts` (API proxy rewrites mapping `/api/:path*` to `http://localhost:3001/api/:path*`)
- **Backend/API Files:**
  - `Development/backend/src/api/trustsense.ts` (`/status`, `/simulation/*`, `/telemetry/*`, bounded microservice timeouts)
  - `Development/backend/src/trust/validator.ts` (TrustValidator physical invariants & envelope enforcement)
  - `Development/backend/src/pipeline/processor.ts` (Rolling 60-step buffer, target leakage prevention, Merkle batching, session deallocation)
  - `Development/backend/src/simulation/engine.ts` (Panasonic 18650PF dataset replay, speed control, duplicate loop prevention, clean session handoff)
  - `Development/backend/src/acquisition/manager.ts` (Multi-transport ingestion, per-device sequencing, freshness watchdog, public disconnect)
  - `Development/backend/src/cloud/storage.ts` (Circuit-broken S3 uploads with local RFC 6962 verified fallback)
  - `Development/backend/src/blockchain/ledger.ts` (Circuit-broken Fabric peer initialization with verified local PostgreSQL adapter)
- **Database Tables & Dependencies:** `telemetry_records`, `quarantined_records`, `prediction_records`, `merkle_batches`, `ledger_anchors`, `simulation_sessions`.
- **Current Behavior:** Both physical BMS telemetry ingestion (Path A) and Panasonic 18650PF dataset replay (Path B) stream seamlessly through the identical validation, windowing, CNN-LSTM inference, and Merkle provenance pipeline. Real-time updates broadcast over SSE (`/api/trustsense/simulation/stream`).
- **Complete Stabilization Record:**
  - **Next.js Proxy Rewrites:** Configured `rewrites()` in `next.config.ts` so browser requests to `/api/...` on port 3000 proxy to port 3001, eliminating HTTP 404 errors.
  - **Bounded Health & Microservice Probes:** Added 2000ms socket timeouts with `req.destroy()` in `trustsense.ts` preventing stalled microservice calls from hanging `GET /api/trustsense/status`.
  - **Event Loop Cooldowns in S3 and Fabric:** Replaced blocking timeouts in `storage.ts` and `ledger.ts` with circuit breakers to prevent synchronous delays exceeding the 5-second `staleMs` threshold, preventing premature buffer resets at Sample 30.
  - **Exclusive Source Handoff:** Added `activeSource = "IDLE"` in `handleDisconnect()` and session release in `engine.start()`, enabling smooth transition from physical device to dataset replay without lockouts.
  - **Multi-State UI Badges & Truthful Counters:** Wired React SSE listeners for dynamic 1Hz freshness tickers, distinct visual operational states (`WAITING FOR BATTERY TELEMETRY`, `CONNECTING...`, `RECEIVING TELEMETRY (X/60 BUFFERING)`, `ACTIVE INFERENCE (60/60 WINDOW)`, `SIMULATION RUNNING`, `QUARANTINED`, `TELEMETRY STALE / TIMEOUT`).
- **Verification Results:**
  - Dedicated E2E suite (`verify_virtual_sensor_pipeline.ts`): 13/13 checks passing (100%).
  - Path A (Physical BMS Ingestion): Sample 1 admitted, Sample 30 batched, Sample 60 triggered PyTorch CNN-LSTM inference (`predictedTemp: 25.30°C`, `latency: 290.8ms`, `target_leakage_prevented: true`), out-of-envelope packet quarantined with `BLOCK` verdict, missing features rejected with HTTP 400.
  - Path B (Dataset Replay): Replay started, 14+ Panasonic 18650PF UDDS samples streamed through identical pipeline, paused, and reset.
  - Full backend regression suite (`npm test`): 13/13 suites passing (100% across all modules).
  - Production builds (`npm run build` backend & frontend): Exit code 0, 0 errors.
- **Acceptance Criteria to Mark STABLE:**
  1. [x] Virtual Sensor page displays truthful, active status indicators (no permanent `Loading pipeline status...` or blank device IDs).
  2. [x] Path A (Physical BMS Ingestion) validates contracts, admits/quarantines samples, advances 60-step window, triggers PyTorch inference with 6 features + held-out target, and anchors Merkle batches.
  3. [x] Path B (Dataset Replay) streams Panasonic 18650PF .mat records through identical pipeline with clear `SIMULATION / DATASET REPLAY` designation.
  4. [x] UI provides distinct truthful visual states for Waiting, Buffering (X/60), Active Inference, Quarantined/Blocked, Simulation Running, and Stale/Timeout.
  5. [x] All backend and frontend production builds compile cleanly.
  6. [x] Complete documentation updated in `STABILIZATION_MATRIX.md` and `TRUSTSENSE_VERIFICATION_REPORT.md`.

---

### Section 5: Thermal AI Inference, Alerts and Sensor Diagnostics
- **Status:** `AUDIT IN PROGRESS`
- **Severity:** Critical
- **Frontend Files:**
  - `Development/frontend/src/app/(app)/thermal-intelligence/page.tsx`
  - `Development/frontend/src/app/(app)/thermal-intelligence/hotspots/page.tsx`
  - `Development/frontend/src/app/(app)/thermal-intelligence/cooling/page.tsx`
  - `Development/frontend/src/app/(app)/thermal-intelligence/sensors/page.tsx`
  - `Development/frontend/src/app/(app)/thermal-intelligence/forecast/page.tsx`
  - `Development/frontend/src/app/(app)/thermal-intelligence/aging/page.tsx`
  - `Development/frontend/src/app/(app)/thermal-events/page.tsx`
  - `Development/frontend/src/app/(app)/thermal-events/[eventId]/page.tsx`
  - `Development/frontend/src/app/(app)/sensor-analysis/page.tsx`
  - `Development/frontend/src/app/(app)/sensor-analysis/placement/page.tsx`
  - `Development/frontend/src/services/thermal.ts`
  - `Development/frontend/src/services/sensors.ts`
  - `Development/frontend/src/services/events.ts`
- **Backend/API Files:**
  - `Development/backend/src/api/thermal.ts`
  - `Development/backend/src/api/virtual-sensor.ts`
  - `Development/backend/src/pipeline/processor.ts`
  - `Inference/thermal_ai.py`
- **Database Tables & Dependencies:** `prediction_records`, `vehicles`, `quarantined_records`.
- **Current Behavior:** Backend `/api/thermal/hotspots` calculates live hotspot status from `vehicles` and `prediction_records`. Local heuristic fallback active when Python microservice is offline.
- **Mocked or Incomplete Areas:**
  - `thermal-intelligence/page.tsx` line 7 imports `{ dashboardSummary } from "@/data/mock"`.
  - `thermal-intelligence/hotspots/page.tsx` line 12 imports `{ batteries } from "@/data/mock"`.
  - `thermal-events/page.tsx` and `[eventId]/page.tsx` rely on `services/events.ts` which returns mock `events` with `delay()`.
  - `services/thermal.ts` and `services/sensors.ts` fall back to `@/data/mock`.
  - Backend `/api/thermal/cooling` uses hardcoded diagnostic objects rather than dynamic vehicle-level sensor telemetry.
- **Bugs, UX Inconsistencies & Security:**
  - Critical disconnect between live telemetry inference records in PostgreSQL and UI display components.
- **Existing Tests:** `run_thermal_diagnostics_checks.ts` (16 assertions passing on backend).
- **Missing Tests:** Frontend end-to-end integration test validating thermal hotspot alert triggering from live DB.
- **Acceptance Criteria to Mark STABLE:**
  1. Remove all mock imports from `thermal-intelligence/*` pages and `services/thermal.ts`, `services/sensors.ts`, `services/events.ts`.
  2. Wire `thermal-events` to real vehicle alerts and work orders in PostgreSQL.
  3. Ensure predictions display genuine `residualDegC` and confidence scores from `prediction_records`.
  4. Verified fallback to local thermal heuristics with explicit UI indicators when inference server is unreachable.

---

### Section 6: Maintenance Work Orders and History
- **Status:** `AUDIT IN PROGRESS`
- **Severity:** Critical
- **Frontend Files:**
  - `Development/frontend/src/app/(app)/maintenance/page.tsx`
  - `Development/frontend/src/app/(app)/maintenance/[vehicleId]/page.tsx`
  - `Development/frontend/src/app/(app)/admin/maintenance/page.tsx`
  - `Development/frontend/src/services/maintenance.ts`
- **Backend/API Files:**
  - `Development/backend/src/api/admin.ts` (`/admin/maintenance`, `/admin/maintenance/work-orders`)
  - `Development/backend/src/api/dashboard.ts` (`/dashboard/maintenance`)
  - `Development/backend/src/api/vehicles.ts`
- **Database Tables & Dependencies:** `work_orders`, `vehicles`, `tenants`.
- **Current Behavior:**
  - Table `work_orders` exists in PostgreSQL with 3 seeded records.
  - Backend `/api/admin/maintenance` allows admins to list, create, and update work orders in PostgreSQL.
  - Backend `/api/dashboard/maintenance` allows authenticated users to view active work orders.
- **Mocked or Incomplete Areas:**
  - `Development/frontend/src/services/maintenance.ts` imports `{ maintenance } from "@/data/mock"` and uses `delay()`. It never calls any backend API.
  - `maintenance/page.tsx` and `maintenance/[vehicleId]/page.tsx` display `<DemoBanner />` and mock items.
  - Non-admin users have no API route or service to manage or update work orders.
- **Bugs, UX Inconsistencies & Security:**
  - Work orders created in Admin Console are completely invisible in the main Maintenance page (`/maintenance`).
  - Total disconnect between database persistence and frontend UI.
- **Existing Tests:** Backend `run_fleet_reports_checks.ts` tests work order persistence in PostgreSQL.
- **Missing Tests:** Frontend API service integration tests for `listMaintenance`, `getMaintenanceByVehicle`, `updateWorkOrder`.
- **Acceptance Criteria to Mark STABLE:**
  1. Rewrite `services/maintenance.ts` to call real backend API endpoints querying PostgreSQL `work_orders`.
  2. Create standard user-accessible work order API endpoints (or wire to `/api/dashboard/maintenance` and `/api/vehicles/:id/maintenance`).
  3. Remove `@/data/mock` and `<DemoBanner />` from `maintenance/page.tsx` and `maintenance/[vehicleId]/page.tsx`.
  4. Validate CRUD operations: creating, filtering, transitioning status (open -> in_progress -> completed).

---

### Section 7: Reports, Analytics and Exports
- **Status:** `STABLE`
- **Severity:** Low
- **Frontend Files:**
  - `Development/frontend/src/app/(app)/reports/page.tsx`
  - `Development/frontend/src/app/(app)/reports/[reportId]/page.tsx`
  - `Development/frontend/src/services/reports.ts`
- **Backend/API Files:**
  - `Development/backend/src/api/reports.ts`
- **Database Tables & Dependencies:** `reports`, `vehicles`, `work_orders`, `merkle_batches`, `ledger_anchors`.
- **Current Behavior:** Authenticated users generate thermal audit reports persisted in PostgreSQL `reports` table. Dynamic export to JSON or CSV blob. Tenant boundary enforced in SQL.
- **Mocked or Incomplete Areas:** None.
- **Bugs, UX Inconsistencies & Security:** Cross-tenant access strictly blocked with 403.
- **Existing Tests:** `run_fleet_reports_checks.ts` (14/14).
- **Missing Tests:** Report generation under high telemetry record volumes (100k+ rows).
- **Acceptance Criteria to Mark STABLE:**
  - Criteria met. All report generation and export assertions passing.

---

### Section 8: Evidence Storage, Merkle Verification and Fabric Provenance
- **Status:** `STABLE`
- **Severity:** Low
- **Frontend Files:**
  - `Development/frontend/src/app/(app)/virtual-sensor/page.tsx` (Merkle tree inspector, proof path verifier, Fabric ledger state)
- **Backend/API Files:**
  - `Development/backend/src/api/trustsense.ts` (`/provenance/*`, `/evidence/*`, `/storage/probe`)
  - `Development/backend/src/provenance/merkle.ts`
  - `Development/backend/src/cloud/storage.ts`
  - `Development/backend/src/blockchain/ledger.ts`
- **Database Tables & Dependencies:** `merkle_batches`, `ledger_anchors`, `telemetry_records`, `battery_passports`. `@aws-sdk/client-s3`, `@hyperledger/fabric-gateway`.
- **Current Behavior:** Real cryptographic Merkle tree root calculation, RFC 6962 inclusion proofs, Fabric transaction submission, S3 evidence persistence with SHA-256 integrity verification, and interactive tampering detection.
- **Mocked or Incomplete Areas:** None. Verified against live Docker Fabric consortium and AWS S3 compatible adapter.
- **Bugs, UX Inconsistencies & Security:** Path traversal attacks blocked. Cross-tenant evidence access forbidden.
- **Existing Tests:** `run_merkle_checks.ts` (8/8), `run_s3_storage_checks.ts` (8/8), `run_fabric_ledger_checks.ts` (10/10).
- **Missing Tests:** None.
- **Acceptance Criteria to Mark STABLE:**
  - Criteria met. 26/26 provenance assertions passing.

---

### Section 9: Billing, Subscriptions, Invoices and Razorpay
- **Status:** `STABLE`
- **Severity:** Low
- **Frontend Files:**
  - `Development/frontend/src/app/(app)/checkout/page.tsx`
  - `Development/frontend/src/app/(app)/admin/billing/page.tsx`
  - `Development/frontend/src/services/admin.ts`
  - `Development/frontend/src/lib/razorpay.ts`
- **Backend/API Files:**
  - `Development/backend/src/index.ts` (`/api/create-order`, `/api/verify-payment`, `/api/billing/webhook`)
  - `Development/backend/src/api/admin.ts` (`/admin/billing/*`)
  - `Development/backend/src/billing/razorpay.ts`
- **Database Tables & Dependencies:** `subscriptions`, `billing_invoices`, `billing_orders`, `tenants`. Razorpay SDK.
- **Current Behavior:** Server-side trusted catalog pricing ($1,499 Professional, $2,490 Enterprise). HMAC-SHA256 signature verification. Raw-body webhook verification. Razorpay DSC probe ports intercepted via `installDscProbeInterceptor`. Permissions-Policy headers configured. Rate-limited.
- **Mocked or Incomplete Areas:** None (operating in authorized Razorpay Test Mode).
- **Bugs, UX Inconsistencies & Security:** Unsafe header CORS warnings and loopback port probes resolved.
- **Existing Tests:** `run_billing_checks.ts` (9/9), `run_razorpay_checkout_checks.ts` (21/21).
- **Missing Tests:** None.
- **Acceptance Criteria to Mark STABLE:**
  - Criteria met. 30/30 billing and checkout assertions passing.

---

### Section 10: User Management, Tenant Management and Administration
- **Status:** `AUDIT IN PROGRESS`
- **Severity:** Medium
- **Frontend Files:**
  - `Development/frontend/src/app/(app)/admin/page.tsx`
  - `Development/frontend/src/app/(app)/admin/users/page.tsx`
  - `Development/frontend/src/app/(app)/profile/page.tsx`
  - `Development/frontend/src/services/admin.ts`
- **Backend/API Files:**
  - `Development/backend/src/api/admin.ts` (`/admin/stats`, `/admin/users`)
  - `Development/backend/src/api/auth.ts` (`/auth/me`)
- **Database Tables & Dependencies:** `users`, `tenants`, `tenant_users`.
- **Current Behavior:** Admin user management (listing, role updates, suspension, deletion) backed by PostgreSQL `users` table.
- **Mocked or Incomplete Areas:**
  - `Development/frontend/src/app/(app)/profile/page.tsx` imports `{ currentUser } from "@/data/mock"`.
  - Profile page hardcodes tenant name "Global Fleet Ops" instead of reading actual tenant from session or API.
- **Bugs, UX Inconsistencies & Security:**
  - User edits in profile are not synced to PostgreSQL.
- **Existing Tests:** Covered in `run_phase5_acceptance_checks.ts`.
- **Missing Tests:** Tenant switching and multi-tenant user assignment tests.
- **Acceptance Criteria to Mark STABLE:**
  1. Update `profile/page.tsx` to read user and tenant data exclusively from `/api/auth/me`.
  2. Remove `@/data/mock` and `<DemoBanner />` from `profile/page.tsx`.
  3. Implement user profile update endpoint (name, password change) in `/api/auth`.

---

### Section 11: System Settings, Health Checks and Provider Diagnostics
- **Status:** `AUDIT IN PROGRESS`
- **Severity:** Medium
- **Frontend Files:**
  - `Development/frontend/src/app/(app)/settings/page.tsx`
  - `Development/frontend/src/app/(app)/admin/traffic/page.tsx`
- **Backend/API Files:**
  - `Development/backend/src/index.ts` (`/health`, `/ready`)
  - `Development/backend/src/api/admin.ts` (`/admin/traffic`)
  - `Development/backend/src/trust/run_provider_diagnostics.ts`
- **Database Tables & Dependencies:** PostgreSQL connection probe `SELECT 1;`.
- **Current Behavior:** Backend provides `/health` (process liveness), `/ready` (operational dependency probe across DB, inference, S3, Fabric, Razorpay), and `/admin/traffic` (request latency percentiles and bandwidth).
- **Mocked or Incomplete Areas:**
  - `Development/frontend/src/app/(app)/settings/page.tsx` imports `{ currentUser } from "@/data/mock"`.
  - Settings page renders `<DemoBanner />` and explicitly notes: *"Changes stay in this browser until account APIs exist."*
- **Bugs, UX Inconsistencies & Security:**
  - Preferences saved on `/settings` do not persist across browser sessions or devices.
- **Existing Tests:** `run_provider_diagnostics.ts` verifies readiness probe.
- **Missing Tests:** Frontend settings persistence tests.
- **Acceptance Criteria to Mark STABLE:**
  1. Remove `@/data/mock` and `<DemoBanner />` from `settings/page.tsx`.
  2. Add user preferences persistence endpoint or store cleanly in local storage with proper fallback.
  3. Expose `/ready` diagnostic metrics in an administrative system status panel.

---

### Section 11: Admin Console & Platform Operations (`/admin`, `/admin/traffic`, `/admin/users`, `/admin/maintenance`, `/admin/billing`)
- **Status:** `STABLE`
- **Severity:** Critical
- **Frontend Files:**
  - `Development/frontend/src/app/(app)/admin/page.tsx` (Admin Overview Hub)
  - `Development/frontend/src/app/(app)/admin/traffic/page.tsx` (User Traffic & Telemetry Analytics)
  - `Development/frontend/src/app/(app)/admin/users/page.tsx` (User Pool & Organization Management)
  - `Development/frontend/src/app/(app)/admin/maintenance/page.tsx` (Fleet & Infrastructure Maintenance)
  - `Development/frontend/src/app/(app)/admin/billing/page.tsx` (Billing, Quotas & Ledger Provenance)
  - `Development/frontend/src/services/admin.ts` (API client for admin operations)
- **Backend/API Files:**
  - `Development/backend/src/api/admin.ts` (Complete genuine PostgreSQL routes: `/stats`, `/users`, `/traffic`, `/maintenance`, `/maintenance/diagnostics`, `/billing`)
  - `Development/backend/src/metrics/traffic.ts` (Real rolling-window traffic analytics and percentiles)
  - `Development/backend/src/index.ts` (Traffic logging middleware with JWT tenant extraction)
- **Database Tables & Dependencies:** `users`, `tenants`, `tenant_users`, `company_profiles`, `vehicles`, `work_orders`, `subscriptions`, `billing_invoices`, `billing_orders`, `telemetry_records`, `prediction_records`, `ledger_anchors`.
- **Audit Findings & Eliminated Mock/Hardcoded Data:**
  1. **Admin Hub (`/admin`):**
     - *Eliminated:* Hardcoded recent operations feed ("New User Registration 10m ago", "Merkle Tree Batch Anchor block #184920 25m ago", "Work Order WO-9402 Scheduled 1h ago").
     - *Eliminated:* Hardcoded platform services badges ("99.99%", "Execution time: 11.8ms", "Active", "Synced").
     - *Eliminated:* Hardcoded backend stat fallbacks (`activeWorkOrders: 3`, `urgentTickets: 1`, `scheduledCalibrations: 2`, `systemHealth: "99.98%"`, `monthlyRecurringRevenue: 2490`, `nextInvoiceDate: "2026-11-01"`).
     - *Genuine Replacement:* Real counts from PostgreSQL `users`, `work_orders`, `vehicles`, `subscriptions`, and `ledger_anchors`. Live DB ping latency probe (`performance.now()` around `SELECT 1`). Live recent operations feed dynamically synthesized from timestamped rows in `users`, `ledger_anchors`, and `work_orders`.
  2. **Traffic Analytics (`/admin/traffic`):**
     - *Eliminated:* Hardcoded endpoint array (`/api/trustsense/status`, etc.) returned when request buffer had 0 hits.
     - *Eliminated:* Hardcoded tenant (`VG Marine Tech Ops` with fake `100.0%` share for 0 requests).
     - *Genuine Replacement:* Traffic tracker records actual incoming HTTP requests with duration, status code, and payload bytes. Extracts tenant attribution from JWT tokens. Returns honest empty states (`[]`) when no requests have occurred in the active window.
  3. **User Management (`/admin/users`):**
     - *Eliminated:* Missing tenant and company profile relationships.
     - *Genuine Replacement:* Multi-table LEFT JOIN across `users`, `tenant_users`, `tenants`, and `company_profiles`. Displays genuine company name, tenant ID, email, role, and registration date.
     - *Security Hardening:* Password hashes and secrets strictly stripped from response. Admin cannot delete or suspend their own logged-in account (HTTP 403 / 400).
  4. **Fleet & Node Maintenance (`/admin/maintenance`):**
     - *Eliminated:* Fake `setTimeout` 1500ms delay in "Run System Diagnostics" button and fabricated success alert.
     - *Eliminated:* Hardcoded SLA string (`value="99.98%"`).
     - *Eliminated:* Hardcoded sensor calibrations (`S-184`, `S-292`, `S-305` with static drift errors).
     - *Eliminated:* Hardcoded CPU/memory approximations (`14%`, `35%`, `320 MB`).
     - *Genuine Replacement:* Real PostgreSQL `work_orders` queue. Sensor calibration register dynamically derived from real battery packs in `vehicles` table (`BAT-PAN18650PF-001`, `B-1092`, `B-3011`, etc.) displaying actual $\Delta T$, $T_{\max}$, and sensor health. New authenticated endpoint `POST /api/admin/maintenance/diagnostics` executing live probes across all 4 microservices with measured latency.
  5. **Billing & Provenance Ledger (`/admin/billing`):**
     - *Eliminated:* Fallback fake invoice (`INV-2026-10`, `$2,490.00`) when database invoices empty.
     - *Eliminated:* Fallback fake genesis anchor (`tx_genesis_anchor_bms`, Block #100) when anchors empty.
     - *Genuine Replacement:* Real `subscriptions` query (`amountMonthly: 0` if no active subscription). Real `billing_invoices` queried from PostgreSQL with honest empty state when 0 invoices exist. Real `ledger_anchors` queried with honest empty state when 0 anchors exist. Quota meters calculated against active plan from `telemetry_records`, `prediction_records`, and `ledger_anchors`. Test mode records clearly labeled (`DEV_TEST_MODE`) and excluded from settled revenue.
- **Verification Results:**
  - Automated test suite `src/trust/run_admin_dashboard_checks.ts`: 23/23 assertions passed (100%).
  - Backend regression test suite (`npm test`): 14/14 test suites passed.
  - Backend build (`npm run build`): Clean compilation (`tsc` exit 0).
  - Frontend Turbopack production build (`npm run build`): All 31/31 routes compiled cleanly without errors.
- **Acceptance Criteria Satisfied:**
  1. [x] Zero mock data, simulated delays, or hardcoded fallbacks across all 5 admin pages.
  2. [x] Every KPI, table row, chart, and status badge backed by genuine database records or live instrumentation.
  3. [x] Strict admin authorization and credential protection enforced.
  4. [x] Live microservice diagnostics probe verified against real endpoints.
  5. [x] Honest empty, loading, and error states across all widgets.

---

## Stabilization Priority Recommendation (Phase E)

### Prioritized Section for Cycle 1: Section 6 — Maintenance Work Orders and History

#### Concrete Defects Discovered:
1. **Total Frontend Mock Dependency:** `Development/frontend/src/services/maintenance.ts` imports `{ maintenance } from "@/data/mock"` and uses `delay()`. It does not make any HTTP calls to the backend.
2. **Disconnected Database Records:** PostgreSQL table `work_orders` has real seeded records and an active schema, but user-facing pages (`/maintenance` and `/maintenance/[vehicleId]`) never display or interact with these database records.
3. **Ghost Work Orders:** Work orders created or modified by an administrator in `/admin/maintenance` do not appear on `/maintenance` or `/vehicles/[vehicleId]`, creating confusion and severe data inconsistency.
4. **Misleading User Experience:** The maintenance page displays a persistent `<DemoBanner />`, informing the user that thermal recommendations and work orders are static demo values.

#### Business and Technical Impact:
- Maintenance work orders represent the primary operational output of thermal anomaly detection. If work orders remain disconnected from PostgreSQL, thermal anomaly alerts cannot lead to genuine, trackable operational actions.
- Fixing Section 6 bridges the core link between fleet health, telemetry diagnostics, and operational workflows.

#### Concrete Acceptance Criteria for Section 6 Stabilization:
1. **Backend API Extension:** Ensure standard authenticated users (role `user`, `operator`, `admin`) have secure endpoints to list, view, create, and update work orders scoped by `tenantId`.
2. **Frontend Service Realignment:** Refactor `Development/frontend/src/services/maintenance.ts` to replace all mock imports and `delay()` calls with real `api.get`, `api.post`, `api.patch` calls.
3. **UI Realignment & Polish:**
   - Remove `@/data/mock` and `<DemoBanner />` from `Development/frontend/src/app/(app)/maintenance/page.tsx` and `Development/frontend/src/app/(app)/maintenance/[vehicleId]/page.tsx`.
   - Implement loading, empty, and error states with real data handling.
   - Support updating work order status (e.g. from `open` to `in_progress` or `resolved`) directly from the UI.
4. **Automated Verification:** Add backend integration tests validating work order CRUD, status transitions, and tenant scoping.
5. **Full Regression Pass:** Run the complete regression test suite (`npm test`) and verify 100% pass rate before updating Section 6 status to `STABLE`.
