# 01 — Literature Search Strategy, Screening Protocol, and PRISMA Flow

## 1. Search Scope and Protocol
- **Search Execution Date:** 14 October 2026
- **Target Temporal Window:** 2018 – October 2026 (incorporating foundational sensor/thermal models where required)
- **Primary Scholarly Databases & Indexes:**
  - IEEE Xplore Digital Library
  - Elsevier / ScienceDirect (Journal of Energy Storage, Applied Energy, RESS)
  - MDPI (Energies, Sustainability, Future Internet)
  - SpringerLink / Crossref Works API
  - arXiv / TechRxiv / SSRN preprint repositories
- **Language Restriction:** English only
- **Review Classification:** Rigorous Critical and Structured Literature Review (following PRISMA screening flow guidelines)

---

## 2. Search Syntax & Faceted Query Families
The literature retrieval was structured into four distinct query families addressing RQ1–RQ6:

### Family A: Direct Thermal Virtual Sensing & Temporal Models
- **Query 1:** `("lithium-ion battery" OR "LIB") AND ("virtual temperature sensor" OR "soft sensor") AND ("CNN-LSTM" OR "LSTM")`
- **Query 2:** `("battery surface temperature" OR "core temperature estimation") AND ("deep learning" OR "convolutional neural network")`
- **Query 3:** `("temperature field prediction" OR "thermal field reconstruction") AND ("lithium-ion battery") AND ("temporal network" OR "attention")`

### Family B: Physics-Informed & Multiphysics Thermal Estimation
- **Query 4:** `("battery thermal management system" OR "BTMS") AND ("physics-informed" OR "multiphysics") AND ("neural network" OR "state-space")`

### Family C: BMS Telemetry Anomaly Detection & Sensor Cybersecurity
- **Query 5:** `("battery management system" OR "BMS") AND ("sensor anomaly detection" OR "fault diagnosis") AND ("cyber-physical" OR "false data injection")`
- **Query 6:** `("battery telemetry" OR "sensor trust") AND ("anomaly detection" OR "OOD") AND ("deep learning")`

### Family D: Data Integrity, Provenance & Blockchain Architecture
- **Query 7:** `("battery management system" OR "battery telemetry") AND ("blockchain" OR "data provenance" OR "Merkle tree")`
- **Query 8:** `("cyber-physical system" OR "IoT telemetry") AND ("data integrity" OR "immutability") AND ("permissioned ledger" OR "Hyperledger")`

---

## 3. Inclusion and Exclusion Criteria

| Criterion | Inclusion Rules (Eligible) | Exclusion Rules (Discarded) |
| :--- | :--- | :--- |
| **Topic Scope** | Direct battery temperature prediction, thermal-field reconstruction, BMS telemetry validation, or IoT data provenance | General EV chassis design, motor thermal control, unrelated smart grid forecasting without battery focus |
| **Model Type** | Deep learning (CNN, LSTM, BiLSTM, GRU, Transformers, Hybrid CNN-LSTM) and physics-guided ML | Simple 1st-order empirical lookup tables with no data-driven learning component |
| **Variable Integrity** | Studies explicitly predicting temperature (direct thermal) or explicitly addressing sensor cyber-anomalies/provenance | Studies predicting purely SOC/SOH/RUL masquerading as thermal papers (adjacent studies strictly labeled as such) |
| **Data Integrity** | Documented real-world drive cycles (UDDS, US06, WLTP, HWFET) or laboratory cell data (e.g., Panasonic 18650PF, LG HG2) | Studies with unspecified synthetic curves lacking experimental battery validation |
| **Evidence Quality** | Peer-reviewed journal papers, authoritative IEEE conference proceedings, or verified technical preprints with accessible DOIs | Vanity presses, unindexed whitepapers, or non-peer-reviewed blog posts |

---

## 4. PRISMA Screening Flow & Selection Statistics

```
========================================================================
[1. IDENTIFICATION]
Records identified through database searching (IEEE, ScienceDirect, MDPI, Crossref):
- Family A (Thermal Soft Sensing & CNN-LSTM): n = 64
- Family B (Physics-Informed & Field Modelling): n = 38
- Family C (Sensor Faults, Cybersecurity & Anomalies): n = 49
- Family D (Telemetry Integrity & Blockchain Provenance): n = 35
Total Records Identified: N = 186
========================================================================
                                |
                                v
[2. DUPLICATE REMOVAL]
Duplicate records removed across queries: n = 44
Unique records screened: N = 142
========================================================================
                                |
                                v
[3. TITLE & ABSTRACT SCREENING]
Records screened based on Title and Abstract: n = 142
Records excluded (off-topic, generic EV routing, non-thermal pure SOC/SOH): n = 88
Records remaining for full-text eligibility: N = 54
========================================================================
                                |
                                v
[4. FULL-TEXT ELIGIBILITY ASSESSMENT]
Full-text articles evaluated: n = 54
Articles excluded with specific reasons:
  - Discarded (Target leakage / input features contained future temperature): n = 4
  - Discarded (No quantifiable thermal evaluation metrics reported): n = 6
  - Discarded (Pure theoretical blockchain without telemetry relevance): n = 7
  - Discarded (Unverified citation / missing peer review traceability): n = 5
Total Excluded: n = 22
========================================================================
                                |
                                v
[5. FINAL SYNTHESIS COHORT]
Studies included in qualitative & quantitative literature synthesis: N = 32
- Direct Thermal Virtual Sensing Studies (Category 1): n = 16
- Sensor Trust, Anomaly & Cybersecurity Studies (Category 2): n = 8
- Data Provenance & Ledger Architectures (Category 3): n = 8
========================================================================
```
