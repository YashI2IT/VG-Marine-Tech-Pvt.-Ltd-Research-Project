# Figure 2: CNN-LSTM Virtual Temperature Sensor Architecture Pipeline

```mermaid
flowchart LR
    subgraph Inputs [Raw Telemetry Window: L=60 steps]
        V[Terminal Voltage V]
        I[Load Current I]
        Ah[Accumulated Capacity Ah]
        Tamb[Ambient / Chamber Temp]
        P[Calculated Power: V x I]
        Iabs[Absolute Current: |I|]
    end

    subgraph FeatureEng [Standardization & Scaling]
        StandardScaler[StandardScaler Norm]
        OOD[5-Sigma OOD Boundary Check]
    end

    subgraph DeepModel [Deep Hybrid Estimator]
        Conv1D[1D-CNN: 64 Filters, Kernel=3, ReLU]
        LSTM1[LSTM Layer 1: 64 Units, Sequence Return]
        LSTM2[LSTM Layer 2: 32 Units]
        Dense1[Dense Layer: 32 Units, ReLU]
        Dropout[Dropout: 0.2 Rate]
        OutputDense[Dense Output: 1 Unit]
    end

    subgraph Output [Inference & Health Metrics]
        InvScale[Inverse Target Scaler]
        PredTemp[Estimated Battery Temp T_est]
        Health[Confidence Flag: VALID / LOW-CONFIDENCE]
    end

    Inputs --> FeatureEng
    FeatureEng --> DeepModel
    DeepModel --> Output
```
