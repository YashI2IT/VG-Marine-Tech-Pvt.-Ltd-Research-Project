import os
import pytest
import matplotlib.pyplot as plt
import numpy as np

# Change directory context so virtual_sensor can be imported
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from virtual_sensor.core import VirtualTemperatureSensor
from virtual_sensor.data_loader import load_and_preprocess
from virtual_sensor.experiments import (
    run_masking_experiment,
    run_sensor_availability_experiment,
    run_abnormal_data_experiment,
    calculate_metrics
)

# Test files from the notebook
test_files = [
    "06-07-17_08.39 n10degC_UDDS_Pan18650PF.mat",
    "03-27-17_09.06 10degC_UDDS_Pan18650PF.mat"
]

DATA_DIR = os.path.join("wykht8y7tg-1", "Panasonic 18650PF Data")

def main():
    print("==================================================")
    print("PHASE 10 & 16: FINAL VALIDATION & EVALUATION")
    print("==================================================")
    
    sensor = VirtualTemperatureSensor()
    print("Loaded VirtualTemperatureSensor (version: {})".format(sensor.model_version))
    
    # 1. Run the complete test suite
    print("\n--- Running Tests ---")
    retcode = pytest.main(["virtual_sensor/tests/"])
    print("Tests passed!" if retcode == 0 else "Tests failed!")
    
    if retcode != 0:
        return
        
    # 2. Load Evaluation Data
    print("\n--- Loading Evaluation Data ---")
    eval_dfs = []
    for file_name in test_files:
        path = os.path.join(DATA_DIR, file_name)
        if not os.path.exists(path):
            # Try recursive search if needed, but in our case it's in specific folders:
            # -10degC and 10degC
            # Let's find them
            pass
            
    # Quick fix for paths
    actual_test_paths = [
        r"wykht8y7tg-1\Panasonic 18650PF Data\-10degC\Drive Cycles\06-07-17_08.39 n10degC_UDDS_Pan18650PF.mat",
        r"wykht8y7tg-1\Panasonic 18650PF Data\10degC\Drive Cycles\03-27-17_09.06 10degC_UDDS_Pan18650PF.mat"
    ]
    
    df1 = load_and_preprocess(actual_test_paths[0])
    df2 = load_and_preprocess(actual_test_paths[1])
    
    # We will use df1 for experiments
    
    # 3. Proper Evaluation (Phase 10)
    print("\n--- Proper Evaluation (Baseline Inference) ---")
    metrics_all, actuals, preds = run_masking_experiment(df1, sensor)
    
    # Generate Plots
    plt.figure(figsize=(10, 5))
    plt.plot(actuals, label="Actual")
    plt.plot(preds, label="Predicted")
    plt.title("Actual vs Predicted Battery Temperature")
    plt.legend()
    plt.savefig("actual_vs_predicted.png")
    
    residuals = np.array(actuals) - np.array(preds)
    plt.figure(figsize=(10, 5))
    plt.hist(residuals, bins=50)
    plt.title("Residual Distribution")
    plt.savefig("residual_distribution.png")
    
    # 4. Validate the masking & sensor availability experiments (Phase 4 & 5)
    avail_results = run_sensor_availability_experiment(df1, sensor)
    
    # 5. Validate abnormal-data experiments (Phase 7)
    abnormal_results = run_abnormal_data_experiment(df1, sensor)
    
    print("\n==================================================")
    print("FINAL EVALUATION METRICS:")
    print("MAE:", metrics_all["MAE"])
    print("RMSE:", metrics_all["RMSE"])
    print("R2:", metrics_all["R2"])
    print("Max Absolute Error:", metrics_all["Max_Abs_Error"])
    print("\nEvaluation successfully completed.")

if __name__ == "__main__":
    main()
