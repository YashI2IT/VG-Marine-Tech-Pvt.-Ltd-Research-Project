# Virtual Temperature Sensor Module Documentation

## A. Input signals
The module accepts raw telemetry data containing:
- `time_s`: Time in seconds.
- `voltage_v`: Battery voltage (V).
- `current_a`: Battery current (A).
- `ah`: Accumulated capacity/Current history (Ah).
- `chamber_temp_degC`: Ambient/chamber temperature (°C).
- `battery_temp_degC`: Measured battery temperature (°C).

## B. Feature engineering
The raw signals are processed into:
- `power_w`: Calculated as `voltage_v * current_a`.
- `current_abs_a`: Absolute value of `current_a`.
- `temp_difference_degC`: Difference between `battery_temp_degC` and `chamber_temp_degC`. (Note: this is not used in the input features for inference to prevent target leakage).

The actual input features to the CNN-LSTM model are:
1. `voltage_v`
2. `current_a`
3. `ah`
4. `chamber_temp_degC`
5. `power_w`
6. `current_abs_a`

## C. Sequence length
The model expects a fixed sequence length of **60 time steps**. At standard 1 Hz sampling rate, this represents a 60-second window.

## D. Preprocessing
- Duplicates and NaN values are removed.
- Chamber temperatures are standardized for each dataset (e.g. `n10degC` mapped strictly to `-10.0`).
- Features are scaled using `StandardScaler` fitted on the training set.
- Target temperature is scaled using a separate `StandardScaler`.

## E. CNN-LSTM architecture
The model consists of:
- `Conv1D`: 64 filters, kernel size 3, ReLU activation.
- `LSTM`: 64 units, returning sequences.
- `LSTM`: 32 units.
- `Dense`: 32 units, ReLU activation.
- `Dropout`: 0.2 rate.
- `Dense`: 1 output (predicts standardized temperature).

## F. Training setup
- Optimizer: Adam
- Loss: Mean Squared Error (MSE)
- Metric: Mean Absolute Error (MAE)
- Early Stopping: Patience of 5 based on validation loss.
- Batch Size: 64

## G. Inference flow
The single entry point `predict_temperature(telemetry_window, reference_temp, mask_temperature)` processes incoming DataFrames (len >= 60). It automatically handles the preprocessing, scaling, and generates predictions and metadata (like timestamp, confidence, and sensor health).

## H. Sensor masking
Sensor masking simulates the removal of the physical temperature measurement. During masking, `reference_temp` is evaluated purely for metrics generation, while the model estimates the true temperature using only electrical measurements and chamber ambient conditions.

## I. Residual calculation
Residuals are calculated as: `residual = measured_temperature - predicted_temperature`.
A rolling history of residuals is maintained to support health indicators.

## J. Confidence/quality indicator
Confidence is reported as:
- `VALID`: Nominal conditions.
- `LOW-CONFIDENCE`: E.g., when Out-Of-Distribution (OOD) inputs are detected, or residuals exceed a defined extreme limit.
- `INVALID`: If the input sequence is too short or contains illegal NaNs.

## K. OOD handling
Out-of-Distribution checks examine scaled input values. If any feature deviates beyond 5 standard deviations from the training distribution mean, it is marked as `POTENTIALLY OOD`.

## L. Evaluation methodology
Evaluation compares inference against the unseen UDDS drive cycle. Metrics calculated:
- Mean Absolute Error (MAE)
- Root Mean Squared Error (RMSE)
- Maximum Absolute Error
- R² Score

## M. Limitations
- **Advisory Virtual Sensing:** The virtual sensing estimate is strictly advisory and cannot replace physical hardware safety systems.
- **Experimental Setup Constraints:** The current dataset represents a limited experimental setup on Panasonic 18650PF cells.
- **Thermal Gradients:** Full battery-pack temperature-field reconstruction is NOT yet claimed.
- **Cybersecurity:** Cybersecurity classification is NOT part of this module. Sensor reduction cannot be evaluated solely on average prediction error. Abnormal sensor behavior does not automatically trigger cyber-alarms.
