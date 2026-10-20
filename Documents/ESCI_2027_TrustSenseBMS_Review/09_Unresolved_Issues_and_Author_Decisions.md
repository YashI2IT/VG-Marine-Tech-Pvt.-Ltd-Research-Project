# 09 — Unresolved Issues, Open Questions, and Author Decisions

The following specific items require your final confirmation before final PDF compilation and CMT submission:

---

## 1. Author Identification & Affiliation Freeze
- **Issue:** IEEE ESCI-2027 strictly prohibits any addition, deletion, or reordering of authors once the CMT Paper ID is generated.
- **Required Author Decision:**
  - Finalize the complete list of authors in their exact publication order.
  - Confirm official affiliations (e.g., *VG Marine Tech Pvt. Ltd.* vs academic university/department).
  - Confirm the designated Corresponding Author.

---

## 2. Track Confirmation
- **Issue:** The conference specifies:
  - Track 1: Smart Computing
  - Track 2: Image and Signal Processing
  - Track 3: IoT and Automation
- **Recommendation:** Submit under **Track 1: Smart Computing** as the primary track (covering deep learning, CNN-LSTM, and temporal AI), while listing IoT and BMS telemetry as secondary keywords.
- **Required Author Decision:** Confirm agreement with Track 1 selection.

---

## 3. Demarcation of Project Baseline vs Literature Review
- **Issue:** IEEE reviewers strictly reject review papers that masquerade as original experimental papers without disclosing dataset splits, or that claim full platform validation without experimental evidence.
- **Resolution in Draft:**
  - The manuscript explicitly designates the CNN-LSTM results ($MAE = 1.5407$ °C, $RMSE = 2.0758$ °C, $R^2 = 0.9736$) as a *project-specific single-cell baseline* evaluated on the Panasonic 18650PF dataset under UDDS at -10 °C.
  - The cloud backend, Merkle-tree anchoring, and Hyperledger Fabric integration are explicitly identified as the *proposed TrustSense-BMS architectural roadmap*, avoiding premature operational claims.
- **Required Author Decision:** Confirm that this demarcation accurately matches your project disclosure policy.

---

## 4. Final Text Authoring & Institutional Similarity Check
- **Issue:** Conference policy mandates that AI-generated text not exceed 10%, and similarity not exceed 20% overall (10% single source).
- **Required Author Decision:**
  - Use the detailed `06_Manuscript_Skeleton_IEEE/paper_scaffold.md` and `main.tex` to finalize your personal prose.
  - Run the final compiled PDF through your institution's Turnitin / iThenticate account before submitting to CMT.
