import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from .core import VirtualTemperatureSensor

def calculate_metrics(y_true, y_pred):
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2 = r2_score(y_true, y_pred)
    max_err = np.max(np.abs(y_true - y_pred))
    return {
        "MAE": float(mae),
        "RMSE": float(rmse),
        "R2": float(r2),
        "Max_Abs_Error": float(max_err)
    }

def run_masking_experiment(df, sensor):
    """
    Simulates masking the true temperature measurement.
    df: Dataframe with complete experiment.
    """
    print("Running Sensor Masking Experiment...")
    predictions = []
    actuals = []
    
    # We simulate a stream
    for i in range(len(df) - sensor.sequence_length + 1):
        window = df.iloc[i:i+sensor.sequence_length]
        
        # We pass reference_temp but explicitly mask it in prediction
        actual_temp = window["battery_temp_degC"].iloc[-1]
        
        res = sensor.predict_temperature(window, reference_temp=actual_temp, mask_temperature=True)
        if res["predicted_temperature"] is not None:
            predictions.append(res["predicted_temperature"])
            actuals.append(actual_temp)
            
    metrics = calculate_metrics(np.array(actuals), np.array(predictions))
    print("Masking Results:", metrics)
    return metrics, actuals, predictions

def run_sensor_availability_experiment(df, sensor):
    """
    Tests 100% availability vs Hidden target sensor.
    Reduced sensing (e.g. fewer input sensors) would require retraining model with fewer features, 
    so we focus on the Hidden target sensor (masking).
    """
    print("\n--- Sensor Availability Experiment ---")
    
    # 1. 100% Available Reference Sensing (Normal inference where ref is known)
    print("1. 100% Available (Reference Measured Temperature used for Health)")
    # Just running normal streaming
    normal_preds = []
    normal_actuals = []
    
    for i in range(len(df) - sensor.sequence_length + 1):
        window = df.iloc[i:i+sensor.sequence_length]
        actual_temp = window["battery_temp_degC"].iloc[-1]
        res = sensor.predict_temperature(window, reference_temp=actual_temp, mask_temperature=False)
        if res["predicted_temperature"] is not None:
            normal_preds.append(res["predicted_temperature"])
            normal_actuals.append(actual_temp)
            
    metrics_100 = calculate_metrics(np.array(normal_actuals), np.array(normal_preds))
    print("100% Available Metrics:", metrics_100)
    
    # 2. Hidden Target Sensor (Virtual Temperature)
    print("\n2. Hidden Target Sensor (Masking mode - Virtual Temperature)")
    metrics_hidden, _, _ = run_masking_experiment(df, sensor)
    
    return {
        "100_percent": metrics_100,
        "hidden": metrics_hidden
    }

def run_abnormal_data_experiment(df, sensor):
    """
    Injects abnormalities in test data and calculates residuals.
    Cases:
    1. Bias (+5 deg C)
    2. Missing (NaN)
    3. Noise
    """
    print("\n--- Abnormal Data Experiment ---")
    results = {}
    
    # We use a single window for demonstration
    base_window = df.iloc[:sensor.sequence_length].copy()
    actual_temp = base_window["battery_temp_degC"].iloc[-1]
    
    # Baseline
    res_base = sensor.predict_temperature(base_window, reference_temp=actual_temp)
    results["Baseline"] = res_base
    
    # 1. Bias
    biased_window = base_window.copy()
    biased_temp = actual_temp + 5.0
    # Note: We simulate bias only on the reference temp sensor for residual calculation (model doesn't use it as input)
    res_bias = sensor.predict_temperature(biased_window, reference_temp=biased_temp)
    results["Sensor_Bias_5C"] = res_bias
    
    # 2. Missing Temperature
    missing_window = base_window.copy()
    missing_window.loc[missing_window.index[-1], "battery_temp_degC"] = np.nan
    res_missing = sensor.predict_temperature(missing_window, reference_temp=np.nan)
    results["Missing_Temp"] = res_missing
    
    # 3. Voltage Out of Range (OOD)
    ood_window = base_window.copy()
    ood_window.loc[ood_window.index[-1], "voltage_v"] = 100.0  # Extremely high
    res_ood = sensor.predict_temperature(ood_window, reference_temp=actual_temp)
    results["OOD_Voltage"] = res_ood
    
    for k, v in results.items():
        print(f"[{k}] Health: {v['sensor_health']} | Conf: {v['confidence']} | Input: {v['input_status']} | Res: {v['residual']}")
        
    return results
