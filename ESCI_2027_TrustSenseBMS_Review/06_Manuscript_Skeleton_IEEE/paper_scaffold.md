# 06 — IEEE Manuscript Authoring Scaffold (Dual AI-Policy & Author Guide)

**Target Conference:** 9th IEEE International Conference on Emerging Smart Computing and Informatics (ESCI-2027)  
**Track:** Track 1: Smart Computing (Secondary: Track 3: IoT and Automation)  
**Strict AI Policy Rule:** Maximum 10% AI-generated text. The scaffolds below provide structural argumentation, verified reference placements, and prompt questions for the author to write substantive sections.

---

## Title
**A Critical Review of Deep Learning-Based Virtual Temperature Sensing for Lithium-Ion Batteries: CNN–LSTM Models, Trust-Aware Data Validation, and Data Provenance**

---

## Authors & Affiliation Block
*(Fill in CMT prior to final freeze)*
- **Author 1:** [Full Name], [Affiliation/University], [Email], [ORCID]
- **Author 2:** Yash Borade, VG Marine Tech Pvt. Ltd., [Email], [ORCID]
- **Author 3:** [Full Name], [Affiliation/University], [Email], [ORCID]

---

## Abstract Structure [Author to finalize in own words]
- **Sentence 1 (Context):** Growing role of high-energy Li-ion batteries in marine and automotive applications; criticality of thermal runaway prevention.
- **Sentence 2 (Physical Sensing Dilemma):** Explain why physical thermocouples fail (core vs surface thermal lag, wiring harness complexity, reliability degradation).
- **Sentence 3 (Virtual Sensing Opportunity):** Introduce CNN-LSTM virtual temperature sensing and its reported accuracy (MAE < 0.5–1.5 °C).
- **Sentence 4 (The Critical Research Gap):** State that current literature naively assumes pristine telemetry, ignoring sensor drift, noise, and False Data Injection Attacks (FDIA).
- **Sentence 5 (Review Scope):** Critical synthesis of 32 peer-reviewed studies (2018–October 2026) across thermal sensing, sensor trust, and blockchain provenance.
- **Sentence 6 (Methodological Findings):** Expose target leakage, single-cell benchmark bias, and sub-zero error doubling.
- **Sentence 7 (Contribution/Synthesis):** Propose the TrustSense-BMS tripartite design perspective (Virtual Sensing + In-Line Sensor Trust + Off-Chain Ledger Provenance).

---

## Section I: Introduction
### Core Arguments to Write:
1. **Paragraph 1: The Thermal Problem in Battery Energy Storage.**
   - Thermal runaway initiates between 80–120 °C via SEI decomposition and electrolyte breakdown.
   - Maritime and EV environments experience severe dynamic loading (pulsed discharge, fast charging).
   - Cite: Bamati et al. (2024) [S01], Zhao et al. (2024) [S19].
2. **Paragraph 2: Bottlenecks of Physical Temperature Measurement.**
   - Surface thermocouples suffer from 20–60s thermal lag relative to internal core temperature.
   - In-situ embedded sensors compromise cell hermetic sealing.
   - Physical wiring harnesses add 15–20% parasitic mass to battery modules and create failure points.
   - Cite: Wang et al. (2021) [S09], Xie et al. (2023) [S06].
3. **Paragraph 3: Rise of Deep Learning Virtual Sensors & Their Fatal Vulnerability.**
   - Data-driven soft sensors use non-invasive telemetry ($V, I, T_{	ext{amb}}$) with temporal networks (CNN-LSTM).
   - *The Fatal Flaw:* Literature assumes telemetry is immune to corruption. In reality, sensor drift, OOD ambient shifts, or cyber-attacks (FDIA) deceive the model into under-predicting temperature during runaway.
   - Cite: Jiang et al. (2021) [S17], Zhang et al. (2023) [S20].
4. **Paragraph 4: The Need for Provenance & Outline of Contributions.**
   - Marine standards (DNV, ISO 26262) mandate tamper-evident audit trails.
   - State explicit RQs (RQ1–RQ6) and paper structure.

---

## Section II: Review Methodology
### Content to Write:
- Cite search queries and PRISMA statistics from `01_Search_Strategy_and_Screening.md`.
- Explain the rigorous 3-category taxonomy (Direct Thermal, Sensor Trust/Cybersecurity, Data Provenance).
- Emphasize exclusion of pseudo-thermal papers that focus solely on SOC/SOH.

---

## Section III: Battery Thermal Dynamics & Sensing Taxonomy
### Mathematical Grounding to Include:
- Bernardi Heat Generation Equation:
  $$\dot{Q} = I^2 R_{	ext{int}} - I T rac{\partial U_{	ext{ocv}}}{\partial T}$$
- Contrast physical vs virtual sensing mechanisms using Figure 1 taxonomy.

---

## Section IV: Deep-Learning Architectures for Temperature Estimation
### Comparative Subsections:
- **IV-A. 1D-CNN Temporal Feature Extraction:** Spatial filter kernels capture instantaneous rate of current/voltage change.
- **IV-B. LSTM and BiLSTM Sequential Memory:** Gated recurrent mechanisms prevent vanishing gradients over extended multi-hour drive cycles.
- **IV-C. Attention Mechanisms (AM):** Focuses weights dynamically on high C-rate transients.
- **IV-D. Physics-Informed & Transfer Operators:** DeepONet and PINNs enforcing conservation of energy.
- Cite: S01, S02, S03, S04, S05, S08, S12.

---

## Section V: Comparative Literature Analysis
- Embed and discuss **Table A** (from `05_Evidence_Synthesis_and_Research_Gaps.md`).
- Highlight the 3 major methodological traps:
  1. Target leakage (using current temperature to predict temperature).
  2. Sub-zero climatic degradation (error doubling from 0.58 °C to 1.15 °C at -20 °C).
  3. Single-cell benchmark bias (Panasonic 18650PF single cells vs pack thermal gradients).

---

## Section VI: Trustworthy Telemetry & BMS Cybersecurity
- Categorize sensor failure modes (bias, drift, freezing, noise) vs cyber-attacks (FDIA, replay).
- Detail in-line defense mechanisms: Schema checks, 5-$\sigma$ OOD detection, dynamic residual bounds.
- Cite: S17, S18, S20, S21, S24.

---

## Section VII: Data Provenance & Cryptographic Auditability
- Detail the off-chain / on-chain hybrid storage architecture.
- Explain SHA-256 Merkle-tree batching:
  $$	ext{Root} = 	ext{Hash}(	ext{Hash}(H_1 + H_2) + 	ext{Hash}(H_3 + H_4))$$
- Explain why permissioned ledgers (Hyperledger Fabric) are superior to public blockchains for telemetry.
- Cite: S25, S26, S27, S28, S31, S32.

---

## Section VIII: Synthesis — TrustSense-BMS Design Perspective
- Propose the tripartite architecture: Virtual Sensing Engine + In-Line Trust Validation + Off-Chain Immutable Provenance.
- Explicitly disclose project baseline results:
  - Dataset: Panasonic 18650PF NCA single-cell under UDDS at -10 °C.
  - Metrics: MAE 1.5407 °C, RMSE 2.0758 °C, $R^2$ 0.9736.
  - Clarify: Project baseline is an experimental validation on single cells, while pack-level distribution and Hyperledger Fabric integration represent the planned deployment roadmap.

---

## Section IX: Open Challenges & Future Directions
- Cross-chemistry and battery-aging transferability.
- Embedded MCU quantization (FP32 to INT8).
- Lack of open-access datasets combining thermal measurements with cyber-attack injections.

---

## Section X: Conclusion
- Concise synthesis summarizing that deep learning virtual sensors cannot be deployed in safety-critical systems as isolated models without trust validation and verifiable provenance.
