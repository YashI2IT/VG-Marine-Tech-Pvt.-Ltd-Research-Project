/**
 * Unit Test: 5-Sigma Statistical Out-of-Distribution Bounds
 */
describe("Telemetry OOD Bounds & Plausibility", () => {
  test("Detects abnormal temperature spikes beyond 5-sigma", () => {
    const meanTemp = 28.5;
    const stdDev = 1.2;
    const upperLimit = meanTemp + 5 * stdDev; // 34.5 C

    const normalReading = 31.0;
    const anomalousReading = 48.0;

    expect(normalReading <= upperLimit).toBe(true);
    expect(anomalousReading > upperLimit).toBe(true);
  });

  test("Checks battery cell voltage within lithium-ion bounds", () => {
    const minVoltage = 2.5;
    const maxVoltage = 4.25;
    const testVoltage = 3.65;
    expect(testVoltage >= minVoltage && testVoltage <= maxVoltage).toBe(true);
  });
});
