import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from scipy.io import loadmat
# Project root directory
PROJECT_ROOT = r"C:\Users\medha\OneDrive\Documents\TrustSenseBMS"

DATA_DIR = os.path.join(PROJECT_ROOT, "data")
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
selected_files = {
    
    "train": [
        "06-07-17_08.39 n10degC_US06_Pan18650PF.mat",
        "06-07-17_08.39 n10degC_HWFET_Pan18650PF.mat",
        "03-27-17_09.06 10degC_US06_Pan18650PF.mat",
        "03-27-17_09.06 10degC_HWFET_Pan18650PF.mat"
    ],
    
    "validation": [
        "06-10-17_11.25 n10degC_Cycle_1_Pan18650PF.mat",
        "03-28-17_12.51 10degC_Cycle_1_Pan18650PF.mat"
    ],
    
    "test": [
        "06-07-17_08.39 n10degC_UDDS_Pan18650PF.mat",
        "03-27-17_09.06 10degC_UDDS_Pan18650PF.mat"
    ]
}

for split, files in selected_files.items():
    print(f"\n{split.upper()} FILES:")
    
    for file_name in files:
        print(" -", file_name)
test_file = selected_files["train"][0]

test_path = os.path.join(DATA_DIR, test_file)

print("Loading:")
print(test_path)

df = load_battery_file(test_path)

print("\nFile loaded successfully.")
print("Shape:", df.shape)

print("\nColumns:")
print(df.columns.tolist())

df.head()
test_file = selected_files["train"][0]

test_path = os.path.join(DATA_DIR, test_file)

print("Loading:")
print(test_path)

df = load_battery_file(test_path)

print("\nFile loaded successfully.")
print("Shape:", df.shape)

print("\nColumns:")
print(df.columns.tolist())

df.head()
# Creating paths for selected files:

file_paths = {
    "train": [
        os.path.join(DATA_DIR, file_name)
        for file_name in selected_files["train"]
    ],
    
    "validation": [
        os.path.join(DATA_DIR, file_name)
        for file_name in selected_files["validation"]
    ],
    
    "test": [
        os.path.join(DATA_DIR, file_name)
        for file_name in selected_files["test"]
    ]
}

for split, paths in file_paths.items():
    print(f"\n{split.upper()}:")
    
    for path in paths:
        print(" -", os.path.basename(path))
train_data = {}
val_data = {}
test_data = {}

for path in file_paths["train"]:
    file_name = os.path.basename(path)
    train_data[file_name] = load_battery_file(path)

for path in file_paths["validation"]:
    file_name = os.path.basename(path)
    val_data[file_name] = load_battery_file(path)

for path in file_paths["test"]:
    file_name = os.path.basename(path)
    test_data[file_name] = load_battery_file(path)
def fix_chamber_temp(df, file_name):
    df = df.copy()

    if "n10degC" in file_name:
        df["chamber_temp_degC"] = -10.0

    elif "10degC" in file_name:
        df["chamber_temp_degC"] = 10.0

    return df
for file_name in train_data:
    train_data[file_name] = fix_chamber_temp(
        train_data[file_name], file_name
    )

for file_name in val_data:
    val_data[file_name] = fix_chamber_temp(
        val_data[file_name], file_name
    )

for file_name in test_data:
    test_data[file_name] = fix_chamber_temp(
        test_data[file_name], file_name
    )
def clean_battery_df(df):
    df = df.copy()

    df = df.sort_values("time_s").reset_index(drop=True)

    # Remove completely identical rows
    df = df.drop_duplicates().reset_index(drop=True)

    # Remove remaining missing values
    df = df.dropna().reset_index(drop=True)

    return df
def clean_dataset(data_dict):

    cleaned_data = {}

    for file_name, df in data_dict.items():
        cleaned_data[file_name] = clean_battery_df(df)

    return cleaned_data


train_data = clean_dataset(train_data)
val_data = clean_dataset(val_data)
test_data = clean_dataset(test_data)
for split, data_dict in [
    ("TRAIN", train_data),
    ("VALIDATION", val_data),
    ("TEST", test_data)
]:
    print("\n", split)

    for file_name, df in data_dict.items():
        print(f"{file_name} → {len(df):,} samples")
for split, data_dict in [
    ("TRAIN", train_data),
    ("VALIDATION", val_data),
    ("TEST", test_data)
]:
    
    print("\n",split, "\n")
    
    for file_name, df in data_dict.items():
        
        print(
            f"{file_name} → {len(df):,} samples"
        )
def add_features(df):
    df = df.copy()

    df["power_w"] = df["voltage_v"] * df["current_a"]
    df["current_abs_a"] = df["current_a"].abs()
    df["temp_difference_degC"] = (
        df["battery_temp_degC"] - df["chamber_temp_degC"]
    )

    return df
for file_name in train_data:
    train_data[file_name] = add_features(train_data[file_name])

for file_name in val_data:
    val_data[file_name] = add_features(val_data[file_name])

for file_name in test_data:
    test_data[file_name] = add_features(test_data[file_name])
print(train_data[list(train_data.keys())[0]].columns)
from sklearn.preprocessing import StandardScaler
import numpy as np

feature_scaler = StandardScaler()
target_scaler = StandardScaler()
feature_columns = [
    "voltage_v",
    "current_a",
    "ah",
    "chamber_temp_degC",
    "power_w",
    "current_abs_a"
]

target_column = "battery_temp_degC"
X_train_all = np.concatenate([
    train_data[file_name][feature_columns].values
    for file_name in train_data
])

y_train_all = np.concatenate([
    train_data[file_name][target_column].values
    for file_name in train_data
])

print("X_train_all shape:", X_train_all.shape)
print("y_train_all shape:", y_train_all.shape)
feature_scaler.fit(X_train_all)

target_scaler.fit(y_train_all.reshape(-1, 1))
for file_name in train_data:
    train_data[file_name][feature_columns] = feature_scaler.transform(
        train_data[file_name][feature_columns]
    )

    train_data[file_name][target_column] = target_scaler.transform(
        train_data[file_name][target_column].values.reshape(-1, 1)
    ).flatten()


for file_name in val_data:
    val_data[file_name][feature_columns] = feature_scaler.transform(
        val_data[file_name][feature_columns]
    )

    val_data[file_name][target_column] = target_scaler.transform(
        val_data[file_name][target_column].values.reshape(-1, 1)
    ).flatten()


for file_name in test_data:
    test_data[file_name][feature_columns] = feature_scaler.transform(
        test_data[file_name][feature_columns]
    )

    test_data[file_name][target_column] = target_scaler.transform(
        test_data[file_name][target_column].values.reshape(-1, 1)
    ).flatten()
print(train_data[list(train_data.keys())[0]][feature_columns].head())
print()
print(train_data[list(train_data.keys())[0]][target_column].head())
def create_sequences(X, y, window_length=60):
    X_seq = []
    y_seq = []

    for i in range(len(X) - window_length + 1):
        X_seq.append(X[i:i + window_length])
        y_seq.append(y[i + window_length - 1])

    return np.array(X_seq), np.array(y_seq)
train_sequences = {}

for file_name, df in train_data.items():

    X = df[feature_columns].values
    y = df[target_column].values

    X_seq, y_seq = create_sequences(X, y, window_length=60)

    train_sequences[file_name] = (X_seq, y_seq)

    print(file_name)
    print("X:", X_seq.shape)
    print("y:", y_seq.shape)
    print()
val_sequences = {}

for file_name, df in val_data.items():

    X = df[feature_columns].values
    y = df[target_column].values

    X_seq, y_seq = create_sequences(X, y, window_length=60)

    val_sequences[file_name] = (X_seq, y_seq)

    print(file_name)
    print("X:", X_seq.shape)
    print("y:", y_seq.shape)
    print()
test_sequences = {}

for file_name, df in test_data.items():

    X = df[feature_columns].values
    y = df[target_column].values

    X_seq, y_seq = create_sequences(X, y, window_length=60)

    test_sequences[file_name] = (X_seq, y_seq)

    print(file_name)
    print("X:", X_seq.shape)
    print("y:", y_seq.shape)
    print()
X_train_seq = np.concatenate([
    train_sequences[file_name][0]
    for file_name in train_sequences
])

y_train_seq = np.concatenate([
    train_sequences[file_name][1]
    for file_name in train_sequences
])

print("X_train_seq shape:", X_train_seq.shape)
print("y_train_seq shape:", y_train_seq.shape)
X_val_seq = np.concatenate([
    val_sequences[file_name][0]
    for file_name in val_sequences
])

y_val_seq = np.concatenate([
    val_sequences[file_name][1]
    for file_name in val_sequences
])

print("X_val_seq shape:", X_val_seq.shape)
print("y_val_seq shape:", y_val_seq.shape)
X_test_seq = np.concatenate([
    test_sequences[file_name][0]
    for file_name in test_sequences
])

y_test_seq = np.concatenate([
    test_sequences[file_name][1]
    for file_name in test_sequences
])

print("X_test_seq shape:", X_test_seq.shape)
print("y_test_seq shape:", y_test_seq.shape)
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv1D, LSTM, Dense, Dropout

model = Sequential([
    Conv1D(
        filters=64,
        kernel_size=3,
        activation="relu",
        input_shape=(60, 6)
    ),

    LSTM(64, return_sequences=True),

    LSTM(32),

    Dense(32, activation="relu"),

    Dropout(0.2),

    Dense(1)
])

model.compile(
    optimizer="adam",
    loss="mse",
    metrics=["mae"]
)

model.summary()
from tensorflow.keras.callbacks import EarlyStopping

early_stopping = EarlyStopping(
    monitor="val_loss",
    patience=5,
    restore_best_weights=True
)
history = model.fit(
    X_train_seq,
    y_train_seq,
    validation_data=(X_val_seq, y_val_seq),
    epochs=20,
    batch_size=64,
    callbacks=[early_stopping],
    verbose=1
)
print("Epochs completed:", len(history.history["loss"]))

print("\nTraining loss:")
print(history.history["loss"])

print("\nValidation loss:")
print(history.history["val_loss"])
print("\nTraining MAE:")
print(history.history["mae"])

print("\nValidation MAE:")
print(history.history["val_mae"])
y_test_pred_scaled = model.predict(
    X_test_seq,
    batch_size=64,
    verbose=1
)

print("Prediction shape:", y_test_pred_scaled.shape)
y_test_pred = target_scaler.inverse_transform(
    y_test_pred_scaled
).flatten()

y_test_actual = target_scaler.inverse_transform(
    y_test_seq.reshape(-1, 1)
).flatten()

print("Predicted temperature range:",
      y_test_pred.min(), "to", y_test_pred.max())

print("Actual temperature range:",
      y_test_actual.min(), "to", y_test_actual.max())
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import numpy as np

mae = mean_absolute_error(y_test_actual, y_test_pred)

rmse = np.sqrt(
    mean_squared_error(y_test_actual, y_test_pred)
)

r2 = r2_score(y_test_actual, y_test_pred)

print("Test MAE :", mae, "°C")
print("Test RMSE:", rmse, "°C")
print("Test R²  :", r2)
import matplotlib.pyplot as plt

plt.figure(figsize=(14, 5))

plt.plot(y_test_actual, label="Actual")
plt.plot(y_test_pred, label="Predicted")

plt.xlabel("Time Steps")
plt.ylabel("Battery Temperature (°C)")
plt.title("Actual vs Predicted Battery Temperature - Test Set")
plt.legend()
plt.show()
# CNN-LSTM model
model.save("cnn_lstm_battery_temperature.keras")

# Preprocessing scalers
import joblib

joblib.dump(feature_scaler, "feature_scaler.pkl")
joblib.dump(target_scaler, "target_scaler.pkl")
import os

print(os.path.abspath("cnn_lstm_battery_temperature.keras"))
