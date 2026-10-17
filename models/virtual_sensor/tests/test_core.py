import os
import pytest
import numpy as np
import pandas as pd
from virtual_sensor.core import VirtualTemperatureSensor

@pytest.fixture
def dummy_telemetry():
    # Create 60 steps of dummy data
    data = {
        "time_s": np.arange(60),
        "voltage_v": np.random.normal(3.5, 0.1, 60),
        "current_a": np.random.normal(-1.5, 0.5, 60),
        "ah": np.random.normal(-1.0, 0.1, 60),
        "chamber_temp_degC": np.full(60, 10.0),
        "power_w": np.random.normal(-5.0, 1.0, 60),
        "current_abs_a": np.random.normal(1.5, 0.5, 60),
        "battery_temp_degC": np.full(60, 25.0)
    }
    return pd.DataFrame(data)

def test_sensor_initialization():
    sensor = VirtualTemperatureSensor()
    assert sensor.sequence_length == 60
    assert len(sensor.feature_columns) == 6

def test_inference_valid(dummy_telemetry):
    sensor = VirtualTemperatureSensor()
    res = sensor.predict_temperature(dummy_telemetry)
    assert res["prediction_status"] == "SUCCESS"
    assert res["input_status"] == "IN-DISTRIBUTION"
    assert res["predicted_temperature"] is not None

def test_inference_short_sequence(dummy_telemetry):
    sensor = VirtualTemperatureSensor()
    short_df = dummy_telemetry.iloc[:50]
    res = sensor.predict_temperature(short_df)
    assert res["prediction_status"] == "FAILED"
    assert res["input_status"] == "INVALID_LENGTH"
    assert res["predicted_temperature"] is None

def test_missing_value(dummy_telemetry):
    sensor = VirtualTemperatureSensor()
    df = dummy_telemetry.copy()
    df.loc[59, "voltage_v"] = np.nan
    res = sensor.predict_temperature(df)
    assert res["input_status"] == "INVALID"
    assert res["prediction_status"] == "FAILED"

def test_ood_detection(dummy_telemetry):
    sensor = VirtualTemperatureSensor()
    df = dummy_telemetry.copy()
    df.loc[59, "voltage_v"] = 100.0  # OOD
    res = sensor.predict_temperature(df)
    assert res["input_status"] == "POTENTIALLY OOD"
    assert res["confidence"] == "LOW-CONFIDENCE"

def test_masking_mode(dummy_telemetry):
    sensor = VirtualTemperatureSensor()
    res = sensor.predict_temperature(dummy_telemetry, reference_temp=25.0, mask_temperature=True)
    assert res["sensor_health"] == "SIMULATED_MASKING"
    assert res["residual"] is not None

def test_residual_calculation(dummy_telemetry):
    sensor = VirtualTemperatureSensor()
    res = sensor.predict_temperature(dummy_telemetry, reference_temp=30.0)
    assert res["residual"] is not None
    # Assuming model predicts ~25
    assert res["sensor_health"] == "NORMAL" or res["sensor_health"] == "MONITOR"
