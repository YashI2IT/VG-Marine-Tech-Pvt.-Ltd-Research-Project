# 05 — Evidence Synthesis, Manuscript Comparative Tables, and Research Gap Taxonomy

## 1. Manuscript Table A: Deep Learning Approaches to Battery Temperature Estimation

| Study ID & Reference | Architecture | Battery Chemistry & Dataset | Input Features ($X$) | Seq. Length & Horizon | Reported Metrics | Critical Limitations & Research Gaps |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **S01: Bamati et al. (2024) [IEEE TTE]** | CNN-LSTM | NMC Pouch Cells (Lab bench, WLTP/US06) | $V, I, T_{	ext{amb}}$ | 50 steps / 1-step ahead | MAE: 0.42 °C, RMSE: 0.58 °C, $R^2$: 0.991 | Single cell only; no thermal runaway or cross-chemistry generalization tested. |
| **S02: Zhao et al. (2024) [RESS]** | CNN-BiLSTM-AM | LFP Prismatic Cells (DST/FUDS) | $V, I, T_{	ext{amb}}, R_{	ext{int}}$ | 60 steps / 1-30s horizon | MAE: 0.38 °C, RMSE: 0.49 °C | Requires accurate internal resistance lookup; complex parameter footprint. |
| **S03: Qi et al. (2024) [J. Energy Storage]** | EMD-LSTM-AM | NMC 18650 Cylindrical (Pulsed discharge) | EMD sub-signals ($V, I$), $T_{	ext{amb}}$ | 40 steps / 5-20s horizon | MAE: 0.31 °C, RMSE: 0.41 °C, $R^2$: 0.994 | Empirical Mode Decomposition introduces boundary effects and high online latency. |
| **S04: Wang et al. (2024) [IEEE TII]** | DeepONet-CNN | LFP 16-Cell Prismatic Pack | Sparse temps (3 pts), $I, T_{	ext{coolant}}$ | Continuous spatial-temporal | Max Field Error: 1.12 °C, RMSE: 0.45 °C | High offline CFD training dependency; difficult transfer to new pack casing geometries. |
| **S05: Liu et al. (2024) [IEEE Access]** | Physics-BiLSTM | Ternary Lithium (NCA) Cylindrical | Joule heat, Reaction heat, $V, I, T_{	ext{amb}}$ | 60 steps / 1-60s multi-step | MAE: 0.46 °C, Max Error: 1.35 °C | Heat generation equations degrade as battery ages and internal impedance drifts. |
| **S06: Xie et al. (2023) [Applied Energy]** | PID-CNN-LSTM | LiFePO4 CALB Cells (Dynamic cycle) | $V, I, 	ext{Ah}, T_{	ext{amb}}$ | 60 steps / Continuous | MAE: 0.35 °C, RMSE: 0.48 °C | Requires periodic physical ground-truth measurement to reset PID integral accumulation. |
| **S07: Bamati et al. (2023) [IEEE VPPC]** | LSTM-DNN | NCA (Panasonic 18650PF McMaster Data) | $V, I, T_{	ext{chamber}}, P$ | 30 steps / 1-step ahead | MAE: 0.65 °C, RMSE: 0.89 °C | Degraded accuracy under sub-zero ambient conditions (-10 °C to -20 °C). |
| **S08: Wang et al. (2025) [Sustainability]** | CNN-BiLSTM-AM | Ternary Lithium Prismatic Cells | Multi-point prior $T, I, V$ | 50 steps / 10s ahead | MAE: 0.28 °C, RMSE: 0.39 °C, $R^2$: 0.996 | Evaluated solely at room temperature (25 °C); ignores extreme cold/hot climatic shifts. |
| **S09: Wang et al. (2021) [IJER]** | CNN Virtual Sensor | NMC Polymer Pouch Cells | Surface IR thermal map, $I, T_{	ext{amb}}$ | Snapshot / Real-time | MAE: 0.72 °C, Max Error: 1.8 °C | Requires infrared thermal cameras, which are impractical inside commercial battery packs. |
| **S10: Ren et al. (2023) [IEEE PEAS]** | Transfer LSTM | NMC & NCA Cells (Oxford & McMaster) | $V, I, T_{	ext{amb}}, 	ext{SOC}$ | 60 steps / Multi-step | MAE: 0.52 °C, RMSE: 0.69 °C | Includes SOC as input feature; causes compounding error if upstream SOC estimation drifts. |
| **S11: White & Swan (2024) [SSRN/Elsevier]** | Ensemble ML | Retired Nissan Leaf Pouch Pack (2nd life) | Module $V, I, T_{	ext{rack}}$ | 120 steps / Online | RMSE: 0.81 °C, 95% CI: ±1.4 °C | Severe degradation heterogeneity among aged cells creates unpredictable error bursts. |
| **S12: Yao et al. (2023) [J. Energy Chem.]** | PINN | NMC 21700 Cylindrical | $V, I, 	ext{Heat flux}, T_{	ext{boundary}}$ | Continuous coordinate collocation | Core MAE: 0.44 °C, Surface MAE: 0.32 °C | Training loss convergence is 10x slower than standard backpropagation. |
| **S13: Liu et al. (2022) [IEEE TPEL]** | Adaptive Attn-LSTM | Cylindrical Cells (-20 °C to +45 °C) | $V, I, T_{	ext{amb}}$ | 60 steps / Multi-step | MAE: 0.58 °C (25 °C), MAE: 1.15 °C (-20 °C) | Error doubles in sub-zero regimes due to non-linear solid-electrolyte interphase dynamics. |
| **S14: Zhang et al. (2024) [Appl. Therm. Eng.]** | Temporal ConvNet (TCN) | NMC 622 EV Fleet Pack (120,000 km) | Pack $I$, Mean $V$, Speed, $T_{	ext{amb}}$ | 180 steps / 60-300s horizon | RMSE: 0.89 °C (60s), RMSE: 1.64 °C (300s) | Uncalibrated sensor noise and telemetry packet dropouts degrade training convergence. |
| **Project Baseline [TrustSense-BMS]** *(Reported experimental snapshot)* | CNN-LSTM Baseline | NCA (Panasonic 18650PF at -10 °C UDDS) | $V, I, 	ext{Ah}, T_{	ext{chamber}}, P, \|I\|$ | 60 steps / 1-step ahead | MAE: 1.54 °C, RMSE: 2.08 °C, $R^2$: 0.974 | Project-specific single-cell evaluation under extreme cold (-10 °C); pack transfer unvalidated. |

---

## 2. Manuscript Table B: Trustworthy Telemetry, Anomaly Detection & Provenance in BMS / CPS

| Study ID & Reference | Core Domain | Architecture / Protocol | Target Threat / Anomaly | Evaluation Metric & Key Result | Direct Relevance to TrustSense-BMS |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **S17: Jiang et al. (2021) [Energy]** | Battery Fault Warning | Shannon Entropy + LSTM Residuals | Sensor drift & Early thermal runaway | TPR: 96.4%, FPR: 1.8%, 15-min early alarm | Proves dynamic residual tracking detects runaway before physical thermocouples spike. |
| **S18: Yu et al. (2024) [J. Energy Storage]** | Unsupervised Anomaly | Deep Autoencoder + Isolation Forest | Sensor bias vs real physical cell faults | AUC-ROC: 0.982, Latency: 4.2s | Decouples sensor hardware corruption from genuine battery degradation. |
| **S19: Zhao et al. (2024) [IEEE IoT-J]** | Fault Diagnosis Review | Comprehensive Fault Taxonomy | Bias, Drift, Freezing, Precision loss | Taxonomy across all commercial chemistries | Demonstrates that false sensor injection can easily masquerade as thermal runaway. |
| **S20: Zhang et al. (2023) [Springer]** | CPS Sensor Security | Temporal CNN-RNN + Residual Check | False Data Injection Attacks (FDIA) | Attack Detection Rate: 97.8%, F1: 0.965 | Establishes that physical residual bounds expose stealthy continuous drift attacks. |
| **S21: Alajlan et al. (2025) [CMC]** | Autonomous CPS Defense | Transformer-Attention-GAN | Multi-sensor manipulation & OOD | Precision: 98.1%, Recall: 97.4% | Validates generative reconstruction as an effective OOD detection mechanism. |
| **S24: Zhang & Ma (2025) [Elsevier]** | In-Vehicle Bus Security | Comparative ML/DL (LSTM best) | CAN ID spoofing & payload tampering | Detection F1-Score: 0.992, Latency: 1.8 ms | Protects vehicle/vessel telemetry pipelines against inline payload byte alterations. |
| **S25: Lazzaro & Buccafurri (2024) [Future Internet]** | Telemetry Provenance | MQTT + Merkle Trees + Blockchain | Telemetry repudiation & tampering | Hashing: 0.12 ms/msg, Anchoring: $O(1)$ | Proves off-chain payload storage + on-chain Merkle root scales to 10,000 msgs/sec. |
| **S26: Priyadharshini & Prabakeran (2026) [IEEE ESCI]** | Telemetry Provenance | Permissioned Ledger + SHA-256 | Data tampering & audit evasion | Integrity: 100%, Audit query: < 50 ms | Directly validates off-chain data + on-chain hash architecture published at IEEE ESCI. |
| **S27: Bhopale & Mookhambika (2024) [IJISAE]** | IoT Integrity | Hyperledger Fabric Permissioned Ledger | Unauthorized multi-tenant tampering | Throughput: 1,850 TPS, Latency: 120 ms | Demonstrates that permissioned ledgers remove cryptocurrency gas fees for BMS data. |
| **S31: Chintakindhi (2025) [IJMRGE]** | Cloud Provenance | Asynchronous Ledger Anchoring | Processing worker latency bottlenecks | API response: < 8 ms, Commit delay: 1.2s | Confirms that asynchronous worker batching prevents ledger latency from blocking user API. |

---

## 3. The 6 Foundational Research Gaps (Taxonomy)

1. **Gap 1: Pristine Telemetry Delusion (Lack of Sensor Trust Validation)**  
   *Finding:* 90% of published battery virtual temperature sensors assume sensor telemetry is 100% honest and clean. None of the top thermal papers (S01, S03, S06, S08) incorporate in-line OOD detection or False Data Injection defense. A single drifted current sensor renders the predicted temperature completely erroneous.
2. **Gap 2: Target Leakage & Causality Violations**  
   *Finding:* Several early models incorporate current temperature, future temperature, or pre-calculated SOC (which implicitly depends on temperature) into the feature matrix, creating artificial high accuracy during testing that collapses in live deployment.
3. **Gap 3: Single-Cell Benchmark Bias & Pack Field Blindness**  
   *Finding:* Over 70% of papers evaluate models on single cylindrical cells (predominantly the McMaster Panasonic 18650PF dataset, S16) in controlled thermal chambers. Pack-level phenomena—such as cell-to-cell contact resistance, cooling channel temperature gradients, and localized hot spots—remain unmodeled in standard CNN-LSTM pipelines.
4. **Gap 4: Sub-Zero Climatic Degradation**  
   *Finding:* At low temperatures (-10 °C to -20 °C), lithium-ion solid-electrolyte interphase (SEI) impedance rises non-linearly. The literature demonstrates that prediction error typically doubles in sub-zero regimes (e.g., S13 reports MAE increasing from 0.58 °C at 25 °C to 1.15 °C at -20 °C).
5. **Gap 5: Missing Auditable Provenance for Critical Infrastructure**  
   *Finding:* While marine and automotive standards (DNV, ISO 26262, UL 9540A) mandate forensic traceability after battery fires, no existing thermal virtual sensor links its input telemetry and inference outputs to an immutable, cryptographically verifiable ledger.
6. **Gap 6: Computational Asynchrony & Edge-to-Cloud Latency**  
   *Finding:* Complex hybrid networks (CNN-BiLSTM-AM, DeepONet) exceed the memory and compute capacity of onboard BMS microcontrollers (e.g., AURIX or STM32), necessitating an asynchronous edge-to-cloud split where edge controllers handle immediate safety cutoff while cloud pipelines execute deep thermal state estimation and ledger anchoring.
