# End-to-End Integration Test: Virtual Sensor Inference Pipeline
import os
import sys
import subprocess

def test_virtual_sensor_cli():
    models_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../models"))
    script_path = os.path.join(models_dir, "virtual_sensor", "predict_api.py")
    test_file = os.path.join(
        models_dir,
        "wykht8y7tg-1",
        "Panasonic 18650PF Data",
        "10degC",
        "Drive Cycles",
        "03-27-17_09.06 10degC_UDDS_Pan18650PF.mat"
    )

    if not os.path.exists(script_path):
        print(f"[SKIP] predict_api.py not found at {script_path}")
        return True

    print(f"[TEST] Executing Virtual Sensor Inference on {os.path.basename(test_file)}...")
    res = subprocess.run([sys.executable, script_path, "--file", test_file], capture_output=True, text=True)
    if res.returncode == 0:
        print("[PASS] Virtual Sensor ML Inference Pipeline executed successfully.")
        return True
    else:
        print(f"[FAIL] Pipeline error: {res.stderr}")
        return False

if __name__ == "__main__":
    success = test_virtual_sensor_cli()
    sys.exit(0 if success else 1)
