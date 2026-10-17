import os
import pandas as pd
from scipy.io import loadmat

def load_battery_file(file_path):
    """
    Load one Panasonic .mat experiment and return
    a standardized battery DataFrame.
    """
    mat_data = loadmat(file_path)
    meas = mat_data["meas"]
    
    df = pd.DataFrame({
        "time_s": meas["Time"][0, 0].flatten(),
        "voltage_v": meas["Voltage"][0, 0].flatten(),
        "current_a": meas["Current"][0, 0].flatten(),
        "ah": meas["Ah"][0, 0].flatten(),
        "battery_temp_degC": meas["Battery_Temp_degC"][0, 0].flatten(),
        "chamber_temp_degC": meas["Chamber_Temp_degC"][0, 0].flatten()
    })
    return df

def fix_chamber_temp(df, file_name):
    df = df.copy()
    if "n10degC" in file_name:
        df["chamber_temp_degC"] = -10.0
    elif "10degC" in file_name:
        df["chamber_temp_degC"] = 10.0
    return df

def clean_battery_df(df):
    df = df.copy()
    df = df.sort_values("time_s").reset_index(drop=True)
    df = df.drop_duplicates().reset_index(drop=True)
    df = df.dropna().reset_index(drop=True)
    return df

def add_features(df):
    df = df.copy()
    df["power_w"] = df["voltage_v"] * df["current_a"]
    df["current_abs_a"] = df["current_a"].abs()
    df["temp_difference_degC"] = (
        df["battery_temp_degC"] - df["chamber_temp_degC"]
    )
    return df

def load_and_preprocess(file_path):
    """Loads, cleans, and adds features to a single battery file."""
    file_name = os.path.basename(file_path)
    df = load_battery_file(file_path)
    df = fix_chamber_temp(df, file_name)
    df = clean_battery_df(df)
    df = add_features(df)
    return df
