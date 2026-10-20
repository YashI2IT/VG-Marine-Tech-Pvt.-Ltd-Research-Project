# Automated Integration Test Runner
import urllib.request
import json
import sys

def run_integration_suite():
    print("=====================================================================")
    print("       ECUlytics Cross-Service Integration Test Suite")
    print("=====================================================================")
    
    passed = 0
    total = 0

    # 1. Health Probe
    total += 1
    try:
        res = urllib.request.urlopen("http://localhost:3001/health")
        if res.status == 200:
            print("[PASS] Backend API Gateway /health returned HTTP 200 OK")
            passed += 1
    except Exception as e:
        print(f"[FAIL] Backend /health connection failed: {e}")

    # 2. Root Platform Info
    total += 1
    try:
        res = urllib.request.urlopen("http://localhost:3001/")
        data = json.loads(res.read().decode())
        if data.get("status") == "operational":
            print(f"[PASS] Platform Metadata Endpoint: {data.get('platform')}")
            passed += 1
    except Exception as e:
        print(f"[FAIL] Root metadata endpoint failed: {e}")

    # 3. Frontend Web App
    total += 1
    try:
        res = urllib.request.urlopen("http://localhost:3000/login")
        if res.status == 200:
            print("[PASS] Frontend Next.js Web App /login returned HTTP 200 OK")
            passed += 1
    except Exception as e:
        print(f"[FAIL] Frontend /login connection failed: {e}")

    # 4. Frontend Registration View
    total += 1
    try:
        res = urllib.request.urlopen("http://localhost:3000/register")
        if res.status == 200:
            print("[PASS] Frontend Next.js Web App /register returned HTTP 200 OK")
            passed += 1
    except Exception as e:
        print(f"[FAIL] Frontend /register connection failed: {e}")

    print("---------------------------------------------------------------------")
    print(f"Results: {passed}/{total} Integration Tests Passed.")
    print("=====================================================================")
    return passed == total

if __name__ == "__main__":
    success = run_integration_suite()
    sys.exit(0 if success else 1)
