import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

// Protect all dashboard routes
router.use(requireAuth);

router.get("/fleet", (req: Request, res: Response) => {
  res.json({
    totalVehicles: 1250,
    healthy: 1100,
    warning: 120,
    critical: 30,
    thermalRiskCount: 15
  });
});

router.get("/thermal-risk", (req: Request, res: Response) => {
  res.json([
    { vehicleId: "V-1042", batteryId: "B-8832", risk: "Critical", tMax: 58.2, dTdt: 0.45, lastUpdate: new Date().toISOString() },
    { vehicleId: "V-2931", batteryId: "B-1092", risk: "Warning", tMax: 49.1, dTdt: 0.12, lastUpdate: new Date().toISOString() }
  ]);
});

router.get("/anomalies", (req: Request, res: Response) => {
  res.json([
    { vehicleId: "V-1042", module: 4, cell: 12, temperature: 58.2, anomalyType: "Hotspot", severity: "High", confidence: 0.94, timestamp: new Date().toISOString() }
  ]);
});

router.get("/hotspot-summary", (req: Request, res: Response) => {
  res.json({
    location: "Module 4, Cell 12",
    tMax: 58.2,
    deltaT: 12.4,
    confidence: 0.94
  });
});

router.get("/cooling-health", (req: Request, res: Response) => {
  res.json({
    status: "Degraded",
    effectiveness: 0.65,
    issues: ["Potential flow blockage in loop B"],
    expectedResponse: -2.0, // expected degC drop per min
    observedResponse: -0.5
  });
});

router.get("/sensor-health", (req: Request, res: Response) => {
  res.json({
    healthy: 94,
    faulty: 2,
    faults: [
      { sensorId: "S-102", type: "Stuck-at", confidence: 0.99 },
      { sensorId: "S-205", type: "Bias/Drift", confidence: 0.85 }
    ]
  });
});

router.get("/thermal-aging", (req: Request, res: Response) => {
  res.json({
    highExposureCount: 45,
    topRiskBatteries: [
      { batteryId: "B-8832", exposureHours: 120, riskIndicator: "High" },
      { batteryId: "B-3011", exposureHours: 85, riskIndicator: "Medium" }
    ]
  });
});

router.get("/forecast", (req: Request, res: Response) => {
  res.json({
    currentTemperature: 58.2,
    forecastTemperature: 62.5,
    horizonMinutes: 10,
    confidenceInterval: [60.1, 64.9]
  });
});

router.get("/maintenance", (req: Request, res: Response) => {
  res.json([
    { vehicleId: "V-1042", problem: "Persistent Hotspot + Cooling Degradation", priority: "Urgent", recommendation: "Derate power to 50%; schedule immediate service for cooling loop B." }
  ]);
});

router.get("/sensor-reduction", (req: Request, res: Response) => {
  res.json({
    currentSensors: 96,
    candidateConfiguration: 24,
    reductionPercentage: 75,
    rmseError: 1.2,
    hotspotCoverage: 0.98,
    faultIsolation: "Successful"
  });
});

router.get("/", (req: Request, res: Response) => {
  res.json({
    fleet: {
      totalVehicles: 1250,
      healthy: 1100,
      warning: 120,
      critical: 30,
      thermalRiskCount: 15
    },
    risks: [
      { vehicleId: "V-1042", batteryId: "B-8832", risk: "Critical", tMax: 58.2, dTdt: 0.45, lastUpdate: new Date().toISOString() },
      { vehicleId: "V-2931", batteryId: "B-1092", risk: "Warning", tMax: 49.1, dTdt: 0.12, lastUpdate: new Date().toISOString() }
    ],
    hotspot: {
      location: "Module 4, Cell 12",
      tMax: 58.2,
      deltaT: 12.4,
      confidence: 0.94
    },
    cooling: {
      status: "Degraded",
      effectiveness: 0.65,
      issues: ["Potential flow blockage in loop B"],
      expectedResponse: -2.0,
      observedResponse: -0.5
    },
    sensors: {
      healthy: 94,
      faulty: 2,
      faults: [
        { sensorId: "S-102", type: "Stuck-at", confidence: 0.99 },
        { sensorId: "S-205", type: "Bias/Drift", confidence: 0.85 }
      ]
    },
    aging: {
      highExposureCount: 45,
      topRiskBatteries: [
        { batteryId: "B-8832", exposureHours: 120, riskIndicator: "High" },
        { batteryId: "B-3011", exposureHours: 85, riskIndicator: "Medium" }
      ]
    },
    forecast: {
      currentTemperature: 58.2,
      forecastTemperature: 62.5,
      horizonMinutes: 10,
      confidenceInterval: [60.1, 64.9]
    },
    maintenance: [
      { vehicleId: "V-1042", problem: "Persistent Hotspot + Cooling Degradation", priority: "Urgent", recommendation: "Derate power to 50%; schedule immediate service for cooling loop B." }
    ],
    sensorReduction: {
      currentSensors: 96,
      candidateConfiguration: 24,
      reductionPercentage: 75,
      rmseError: 1.2,
      hotspotCoverage: 0.98,
      faultIsolation: "Successful"
    }
  });
});

export default router;
