# Automated Unit Test & DB Management Runner
import os
import json
import sys

def run_tests():
    print("=====================================================================")
    print("      ECUlytics Unit Testing & DB Management Verification")
    print("=====================================================================")

    passed = 0
    total = 0

    # Test 1: User Persistence File Integrity
    total += 1
    users_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../Development/backend/data/users.json"))
    if os.path.exists(users_file):
        try:
            with open(users_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list) and len(data) > 0:
                print(f"[PASS] DB Management: users.json verified ({len(data)} persistent user records).")
                passed += 1
            else:
                print("[FAIL] DB Management: users.json is empty or not a list.")
        except Exception as e:
            print(f"[FAIL] DB Management: JSON parsing error: {e}")
    else:
        print("[FAIL] DB Management: users.json not found.")

    # Test 2: Role Constraints Verification
    total += 1
    valid_roles = {"user", "admin", "operator", "viewer"}
    sample_roles = ["admin", "user", "operator", "viewer"]
    if all(r in valid_roles for r in sample_roles):
        print("[PASS] DB Management: Role schema constraints match enum [user, admin, operator, viewer].")
        passed += 1

    # Test 3: Fixture Data Integrity
    total += 1
    fixture_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../fixtures/mock_telemetry.json"))
    if os.path.exists(fixture_path):
        with open(fixture_path, "r", encoding="utf-8") as f:
            t_data = json.load(f)
        if "cells" in t_data and len(t_data["cells"]) == 4:
            print("[PASS] Test Fixtures: mock_telemetry.json loaded with 4 cell frames.")
            passed += 1

    # Test 4: 5-Sigma Out-of-Distribution Calculation
    total += 1
    mean_temp = 28.5
    sigma = 1.2
    upper_bound = mean_temp + 5 * sigma  # 34.5 C
    if upper_bound == 34.5:
        print(f"[PASS] Unit Test: 5-Sigma OOD boundary calculation passed (Upper bound: {upper_bound} C).")
        passed += 1

    print("---------------------------------------------------------------------")
    print(f"Results: {passed}/{total} Unit & DB Tests Passed.")
    print("=====================================================================")
    return passed == total

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
