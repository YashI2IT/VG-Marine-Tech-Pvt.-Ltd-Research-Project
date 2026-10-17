import numpy as np
import pandas as pd
import joblib
import tensorflow as tf
import os
import warnings

class VirtualTemperatureSensor:
    def __init__(self, model_path=None, feature_scaler_path=None, target_scaler_path=None):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        self.model_path = model_path or os.path.join(base_dir, "cnn_lstm_battery_temperature_zipped.keras")
        self.feature_scaler_path = feature_scaler_path or os.path.join(base_dir, "feature_scaler.pkl")
        self.target_scaler_path = target_scaler_path or os.path.join(base_dir, "target_scaler.pkl")
        
        self.model = tf.keras.models.load_model(self.model_path)
        
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            self.feature_scaler = joblib.load(self.feature_scaler_path)
            self.target_scaler = joblib.load(self.target_scaler_path)
            
        self.feature_columns = [
            "voltage_v",
            "current_a",
            "ah",
            "chamber_temp_degC",
            "power_w",
            "current_abs_a"
        ]
        
        self.sequence_length = 60
        self.model_version = "1.0.0"
        
        self.train_means = self.feature_scaler.mean_
        self.train_scales = self.feature_scaler.scale_
        
        # Sensor health configuration
        self.residual_history = []
        self.health_threshold_suspected = 2.0  # degrees C (configurable)
        self.health_persistence_frames = 10
        self.max_history_len = 1000

    def check_ood(self, features_df):
        """
        Check if inputs are outside the training distribution based on standard deviations.
        Returns: 'IN-DISTRIBUTION', 'POTENTIALLY OOD', or 'INVALID INPUT'
        """
        # Check NaNs
        if features_df.isnull().values.any():
            return "INVALID INPUT"
            
        scaled_features = (features_df[self.feature_columns].values - self.train_means) / self.train_scales
        max_deviation = np.max(np.abs(scaled_features))
        
        # If any feature is more than 5 standard deviations away, it's potentially OOD
        if max_deviation > 5.0:
            return "POTENTIALLY OOD"
            
        return "IN-DISTRIBUTION"

    def predict_temperature(self, telemetry_window, reference_temp=None, mask_temperature=False):
        """
        Predicts the battery temperature from a window of telemetry data.
        
        telemetry_window: DataFrame with at least 60 rows and required feature columns.
        reference_temp: Actual temperature if available for calculating residuals and sensor health.
        mask_temperature: If True, indicates we are hiding the true temperature to predict it. 
                          The model doesn't use temperature as an input, so this mostly flags the experiment mode.
        """
        if len(telemetry_window) < self.sequence_length:
            return {
                "predicted_temperature": None,
                "timestamp": None,
                "model_version": self.model_version,
                "input_status": "INVALID_LENGTH",
                "prediction_status": "FAILED",
                "confidence": "INVALID",
                "residual": None,
                "sensor_health": "UNKNOWN"
            }
            
        # Extract exactly the last 60 steps
        window = telemetry_window.tail(self.sequence_length).copy()
        
        # Basic OOD and Validation
        ood_status = self.check_ood(window)
        if ood_status == "INVALID INPUT":
            return {
                "predicted_temperature": None,
                "timestamp": None,
                "model_version": self.model_version,
                "input_status": "INVALID",
                "prediction_status": "FAILED",
                "confidence": "INVALID",
                "residual": None,
                "sensor_health": "UNKNOWN"
            }
            
        # Scale features
        X_scaled = self.feature_scaler.transform(window[self.feature_columns])
        X_input = X_scaled.reshape(1, self.sequence_length, len(self.feature_columns))
        
        # Predict
        y_pred_scaled = self.model.predict(X_input, verbose=0)
        predicted_temp = self.target_scaler.inverse_transform(y_pred_scaled)[0, 0]
        
        # Extract Timestamp if available, otherwise use last index
        timestamp = window["time_s"].iloc[-1] if "time_s" in window.columns else None
        
        # Residual and Sensor Health
        residual = None
        sensor_health = "NORMAL"
        
        if reference_temp is not None and not mask_temperature:
            residual = reference_temp - predicted_temp
            self.residual_history.append(residual)
            if len(self.residual_history) > self.max_history_len:
                self.residual_history.pop(0)
                
            # Assess health based on persistence
            if len(self.residual_history) >= self.health_persistence_frames:
                recent_residuals = self.residual_history[-self.health_persistence_frames:]
                if all(abs(r) > self.health_threshold_suspected for r in recent_residuals):
                    sensor_health = "SUSPECTED SENSOR ISSUE"
                elif any(abs(r) > self.health_threshold_suspected for r in recent_residuals):
                    sensor_health = "MONITOR"
        elif mask_temperature and reference_temp is not None:
            # We are masking. Calculate residual but don't strictly trigger alarms since it's a test
            residual = reference_temp - predicted_temp
            sensor_health = "SIMULATED_MASKING"
            
        # Confidence logic
        confidence = "VALID"
        if ood_status == "POTENTIALLY OOD":
            confidence = "LOW-CONFIDENCE"
        if residual is not None and abs(residual) > self.health_threshold_suspected * 2:
            # If residual is extremely high, confidence in prediction (or sensor) is low
            confidence = "LOW-CONFIDENCE"
            
        return {
            "predicted_temperature": float(predicted_temp),
            "timestamp": float(timestamp) if timestamp is not None else None,
            "model_version": self.model_version,
            "input_status": ood_status,
            "prediction_status": "SUCCESS",
            "confidence": confidence,
            "residual": float(residual) if residual is not None else None,
            "sensor_health": sensor_health
        }
