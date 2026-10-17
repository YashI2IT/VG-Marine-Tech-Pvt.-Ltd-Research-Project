import os
import sys
import json
import argparse
import pandas as pd
import numpy as np
from scipy.io import loadmat
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Change directory context so virtual_sensor can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from virtual_sensor.core import VirtualTemperatureSensor

def parse_args():
    parser = argparse.ArgumentParser(description="Virtual Sensor Predict API")
    parser.add_argument("--file", type=str, required=True, help="Path to the dataset file (.csv or .mat)")
    return parser.parse_args()

def load_data(file_path):
    if file_path.endswith('.mat'):
        try:
            mat_data = loadmat(file_path)
            if "meas" in mat_data:
                meas = mat_data["meas"]
                df = pd.DataFrame({
                    "time_s": meas["Time"][0, 0].flatten() if "Time" in meas.dtype.names else np.arange(len(meas["Voltage"][0, 0].flatten())),
                    "voltage_v": meas["Voltage"][0, 0].flatten() if "Voltage" in meas.dtype.names else None,
                    "current_a": meas["Current"][0, 0].flatten() if "Current" in meas.dtype.names else None,
                    "ah": meas["Ah"][0, 0].flatten() if "Ah" in meas.dtype.names else None,
                    "battery_temp_degC": meas["Battery_Temp_degC"][0, 0].flatten() if "Battery_Temp_degC" in meas.dtype.names else None,
                    "chamber_temp_degC": meas["Chamber_Temp_degC"][0, 0].flatten() if "Chamber_Temp_degC" in meas.dtype.names else None
                })
                return df
        except Exception as e:
            pass
    elif file_path.endswith('.csv'):
        df = pd.read_csv(file_path)
    else:
        df = pd.DataFrame()
        
    if df.empty:
        return df
        
    # Infer chamber temp from filename if missing or all null
    col_name = "chamber_temp_degC" if "chamber_temp_degC" in df.columns else "Chamber_Temp_degC"
    if col_name not in df.columns or df[col_name].isnull().all():
        basename = os.path.basename(file_path).lower()
        if "n10degc" in basename or "-10degc" in basename:
            df[col_name] = -10.0
        elif "10degc" in basename:
            df[col_name] = 10.0
        elif "25degc" in basename:
            df[col_name] = 25.0
        else:
            df[col_name] = 25.0 # Default fallback
            
    return df

def detect_and_map_features(df):
    mapping = {
        'voltage': 'voltage_v', 'voltage_v': 'voltage_v', 'v': 'voltage_v',
        'current': 'current_a', 'current_a': 'current_a', 'i': 'current_a',
        'ah': 'ah', 'capacity': 'ah', 'capacity_ah': 'ah',
        'chamber_temp': 'chamber_temp_degC', 'chamber_temp_degc': 'chamber_temp_degC', 'env_temp': 'chamber_temp_degC',
        'battery_temp': 'battery_temp_degC', 'battery_temp_degc': 'battery_temp_degC', 'temp': 'battery_temp_degC', 'temperature': 'battery_temp_degC',
        'time': 'time_s', 'time_s': 'time_s'
    }
    
    mapped_features = []
    extra_features = []
    
    new_df = pd.DataFrame()
    
    for col in df.columns:
        col_lower = col.lower().strip()
        if col_lower in mapping:
            canonical = mapping[col_lower]
            new_df[canonical] = df[col]
            mapped_features.append({"original": col, "mapped": canonical})
        else:
            extra_features.append(col)
            
    # Compute derived features if base features exist
    if 'voltage_v' in new_df.columns and 'current_a' in new_df.columns:
        if 'power_w' not in new_df.columns:
            new_df['power_w'] = new_df['voltage_v'] * new_df['current_a']
            mapped_features.append({"original": "derived", "mapped": "power_w"})
    
    if 'current_a' in new_df.columns:
        if 'current_abs_a' not in new_df.columns:
            new_df['current_abs_a'] = new_df['current_a'].abs()
            mapped_features.append({"original": "derived", "mapped": "current_abs_a"})
            
    # Default time if missing
    if 'time_s' not in new_df.columns:
        new_df['time_s'] = np.arange(len(new_df))
        
    # Robust fallback for chamber_temp_degC if it's missing or all null
    if 'chamber_temp_degC' not in new_df.columns or new_df['chamber_temp_degC'].isnull().all():
        # Try to infer from a global or default
        new_df['chamber_temp_degC'] = 25.0
        if "chamber_temp_degC" not in [m["mapped"] for m in mapped_features]:
            mapped_features.append({"original": "default_inference", "mapped": "chamber_temp_degC"})
        
    return new_df, mapped_features, extra_features

def main():
    try:
        args = parse_args()
        
        if not os.path.exists(args.file):
            print(json.dumps({"error": f"File not found: {args.file}"}))
            return
            
        df = load_data(args.file)
        if df.empty:
            print(json.dumps({"error": "Failed to parse dataset or empty dataset."}))
            return
            
        samples_count = len(df)
        
        mapped_df, mapped_features, extra_features = detect_and_map_features(df)
        
        sensor = VirtualTemperatureSensor()
        required_features = sensor.feature_columns
        
        missing = [f for f in required_features if f not in mapped_df.columns]
        
        result = {
            "status": "success",
            "dataset_info": {
                "samples": samples_count,
                "detected_features": len(df.columns),
                "required_features": len(required_features),
                "missing": missing,
                "extra": extra_features,
                "mapped": mapped_features,
                "validation": "READY" if not missing else "INVALID"
            }
        }
        
        if missing:
            print(json.dumps(result))
            return
            
        # Do prediction
        # Ensure data is clean
        mapped_df_orig = mapped_df.copy()
        mapped_df = mapped_df.dropna(subset=required_features).reset_index(drop=True)
        if len(mapped_df) < sensor.sequence_length:
            null_counts = mapped_df_orig.isnull().sum().to_dict() if 'mapped_df_orig' in locals() else mapped_df.isnull().sum().to_dict()
            result["status"] = "error"
            result["error"] = f"Insufficient rows after cleaning. Needs at least {sensor.sequence_length} rows. Null counts: {null_counts}"
            print(json.dumps(result))
            return
            
        # We need to run predictions over the dataset
        # Create sequences
        scaled_features = sensor.feature_scaler.transform(mapped_df[required_features].values)
        
        # Optimization: for a responsive demo, we don't need to predict all 200k samples
        # Let's stride by 'step' so we end up with ~1000 predictions max.
        seq_len = sensor.sequence_length
        total_possible = len(scaled_features) - seq_len + 1
        
        max_points = 1000
        step = max(1, total_possible // max_points)
        
        X = []
        indices = []
        for i in range(0, total_possible, step):
            X.append(scaled_features[i:i+seq_len])
            indices.append(i + seq_len - 1)
            
        X = np.array(X)
        
        y_pred_scaled = sensor.model.predict(X, batch_size=256, verbose=0)
        predicted_temps = sensor.target_scaler.inverse_transform(y_pred_scaled).flatten()
        
        preds = []
        actuals = []
        times = []
        has_actual = 'battery_temp_degC' in mapped_df.columns
        
        # We compute metrics on the downsampled subset for speed, which is an approximation 
        # but sufficient for demo purposes.
        for i in range(len(predicted_temps)):
            idx = indices[i]
            preds.append(float(predicted_temps[i]))
            times.append(float(mapped_df['time_s'].iloc[idx]))
            if has_actual:
                actuals.append(float(mapped_df['battery_temp_degC'].iloc[idx]))
                
        metrics = {}
        if has_actual and len(actuals) > 0:
            metrics["MAE"] = float(mean_absolute_error(actuals, preds))
            metrics["RMSE"] = float(np.sqrt(mean_squared_error(actuals, preds)))
            metrics["R2"] = float(r2_score(actuals, preds))
            
        result["prediction"] = {
            "predicted": preds,
            "actual": actuals if has_actual else [],
            "times": times,
            "metrics": metrics if has_actual else None,
            "has_ground_truth": has_actual
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
