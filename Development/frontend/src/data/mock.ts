import type {
  Battery,
  CoolingHealth,
  DashboardSummary,
  Forecast,
  Hotspot,
  MaintenanceItem,
  Module,
  ReportItem,
  SensorConfiguration,
  SensorHealth,
  ThermalAnomaly,
  ThermalEvent,
  ThermalExposure,
  User,
  Vehicle,
} from "@/types/domain";

const DEMO_NOTE = "Demo dataset — not scientific results.";

function cells(moduleId: string, hotspotIndex?: number): Module["cells"] {
  return Array.from({ length: 16 }, (_, i) => {
    const base = 32 + (i % 4) * 0.6;
    const isHotspot = hotspotIndex === i;
    const physicalTemp = isHotspot ? 58.2 : base;
    const virtualTemp = isHotspot ? 57.4 : base + 0.3;
    return {
      id: `${moduleId}-C${String(i + 1).padStart(2, "0")}`,
      moduleId,
      index: i,
      physicalTemp,
      virtualTemp,
      isHotspot,
      status: isHotspot ? "critical" : i % 7 === 0 ? "watch" : "healthy",
    };
  });
}

function moduleOf(batteryId: string, n: number, hotspot?: boolean): Module {
  const id = `${batteryId}-M${n}`;
  const cellList = cells(id, hotspot ? 11 : undefined);
  const temps = cellList.map((c) => c.virtualTemp);
  const tmax = Math.max(...temps);
  const tmin = Math.min(...temps);
  return {
    id,
    batteryId,
    name: `Module ${n}`,
    rows: 4,
    cols: 4,
    cells: cellList,
    metrics: {
      tmax,
      tmin,
      tavg: Number((temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)),
      deltaT: Number((tmax - tmin).toFixed(1)),
      dTdt: hotspot ? 0.45 : 0.08,
      unit: "°C",
    },
  };
}

export const currentUser: User = {
  id: 1,
  email: "admin@eculytics.com",
  name: "Fleet Analyst",
  role: "admin",
  tenantId: "tenant-global",
};

export const vehicles: Vehicle[] = [
  {
    id: "V-1042",
    name: "Route Hauler 12",
    fleet: "Metro North",
    status: "critical",
    batteryId: "B-8832",
    thermalRisk: "critical",
    coolingHealth: "degraded",
    sensorHealth: "faulty",
    lastUpdate: "2026-09-10T04:42:00Z",
    maintenancePriority: "urgent",
    location: "Depot A",
    metrics: { tmax: 58.2, tmin: 45.8, tavg: 49.1, deltaT: 12.4, dTdt: 0.45, unit: "°C" },
  },
  {
    id: "V-2931",
    name: "City Loop 04",
    fleet: "Metro North",
    status: "warning",
    batteryId: "B-1092",
    thermalRisk: "warning",
    coolingHealth: "watch",
    sensorHealth: "healthy",
    lastUpdate: "2026-09-10T04:40:00Z",
    maintenancePriority: "high",
    location: "Route 7",
    metrics: { tmax: 49.1, tmin: 38.4, tavg: 42.0, deltaT: 10.7, dTdt: 0.12, unit: "°C" },
  },
  {
    id: "V-4410",
    name: "Harbor Shuttle 2",
    fleet: "Coastal",
    status: "watch",
    batteryId: "B-3011",
    thermalRisk: "watch",
    coolingHealth: "healthy",
    sensorHealth: "watch",
    lastUpdate: "2026-09-10T04:38:00Z",
    maintenancePriority: "medium",
    location: "Port Gate",
    metrics: { tmax: 44.6, tmin: 36.2, tavg: 39.8, deltaT: 8.4, dTdt: 0.06, unit: "°C" },
  },
  {
    id: "V-1188",
    name: "Express 19",
    fleet: "Coastal",
    status: "healthy",
    batteryId: "B-2201",
    thermalRisk: "info",
    coolingHealth: "healthy",
    sensorHealth: "healthy",
    lastUpdate: "2026-09-10T04:41:00Z",
    maintenancePriority: "low",
    location: "Highway 3",
    metrics: { tmax: 36.4, tmin: 32.1, tavg: 34.0, deltaT: 4.3, dTdt: 0.02, unit: "°C" },
  },
  {
    id: "V-5502",
    name: "Night Freight 08",
    fleet: "Metro North",
    status: "healthy",
    batteryId: "B-4419",
    thermalRisk: "info",
    coolingHealth: "healthy",
    sensorHealth: "healthy",
    lastUpdate: "2026-09-10T04:35:00Z",
    maintenancePriority: "low",
    location: "Yard B",
    metrics: { tmax: 35.1, tmin: 31.8, tavg: 33.2, deltaT: 3.3, dTdt: 0.01, unit: "°C" },
  },
];

export const batteries: Battery[] = vehicles.map((v, i) => ({
  id: v.batteryId,
  vehicleId: v.id,
  chemistry: "NCA 18650 pack (demo)",
  capacityKwh: 72 + i * 4,
  coolingLoop: i === 0 ? "Loop B" : "Loop A",
  modules: [1, 2, 3, 4].map((n) => moduleOf(v.batteryId, n, i === 0 && n === 4)),
  metrics: v.metrics,
}));

export const hotspots: Hotspot[] = [
  {
    id: "HS-01",
    vehicleId: "V-1042",
    batteryId: "B-8832",
    moduleId: "B-8832-M4",
    cellId: "B-8832-M4-C12",
    temperature: 58.2,
    tmax: 58.2,
    deltaT: 12.4,
    dTdt: 0.45,
    severity: "critical",
    confidence: 0.94,
    detectedAt: "2026-09-10T04:18:00Z",
    persistenceMin: 24,
    trend: [46, 48, 51, 53, 55, 57, 58.2],
  },
  {
    id: "HS-02",
    vehicleId: "V-2931",
    batteryId: "B-1092",
    moduleId: "B-1092-M2",
    cellId: "B-1092-M2-C07",
    temperature: 49.1,
    tmax: 49.1,
    deltaT: 10.7,
    dTdt: 0.12,
    severity: "warning",
    confidence: 0.81,
    detectedAt: "2026-09-10T03:52:00Z",
    persistenceMin: 11,
    trend: [42, 43, 44, 46, 47, 48, 49.1],
  },
];

export const anomalies: ThermalAnomaly[] = [
  {
    id: "AN-1042",
    vehicleId: "V-1042",
    batteryId: "B-8832",
    moduleId: "B-8832-M4",
    cellId: "B-8832-M4-C12",
    type: "Localized hotspot",
    severity: "critical",
    temperature: 58.2,
    confidence: 0.94,
    timestamp: "2026-09-10T04:18:00Z",
  },
  {
    id: "AN-2931",
    vehicleId: "V-2931",
    batteryId: "B-1092",
    moduleId: "B-1092-M2",
    cellId: "B-1092-M2-C07",
    type: "Thermal imbalance",
    severity: "warning",
    temperature: 49.1,
    confidence: 0.81,
    timestamp: "2026-09-10T03:52:00Z",
  },
];

export const cooling: CoolingHealth[] = [
  {
    vehicleId: "V-1042",
    status: "degraded",
    effectiveness: 0.65,
    expectedResponse: -2.0,
    observedResponse: -0.5,
    coolantInletC: 18.4,
    coolantOutletC: 27.1,
    issues: ["Potential flow restriction in loop B"],
    confidence: 0.78,
    relatedEventIds: ["EVT-01"],
  },
  {
    vehicleId: "V-2931",
    status: "watch",
    effectiveness: 0.82,
    expectedResponse: -1.6,
    observedResponse: -1.1,
    coolantInletC: 19.0,
    coolantOutletC: 24.2,
    issues: ["Slower than expected heat rejection"],
    confidence: 0.7,
    relatedEventIds: ["EVT-02"],
  },
];

export const sensors: SensorHealth[] = [
  {
    id: "S-102",
    vehicleId: "V-1042",
    location: "Module 4, mid-pack",
    physicalValue: 41.0,
    virtualValue: 56.8,
    residual: -15.8,
    status: "faulty",
    faultType: "stuck-at",
    confidence: 0.99,
    lastUpdate: "2026-09-10T04:42:00Z",
  },
  {
    id: "S-205",
    vehicleId: "V-1042",
    location: "Module 2, coolant side",
    physicalValue: 48.2,
    virtualValue: 46.1,
    residual: 2.1,
    status: "watch",
    faultType: "drift",
    confidence: 0.85,
    lastUpdate: "2026-09-10T04:41:00Z",
  },
  {
    id: "S-441",
    vehicleId: "V-4410",
    location: "Module 1, corner",
    physicalValue: 39.9,
    virtualValue: 40.2,
    residual: -0.3,
    status: "healthy",
    faultType: "none",
    confidence: 0.62,
    lastUpdate: "2026-09-10T04:38:00Z",
  },
];

export const exposures: ThermalExposure[] = [
  {
    batteryId: "B-8832",
    vehicleId: "V-1042",
    exposureHours: 120,
    highTempDurationHours: 18.5,
    eventCount: 7,
    riskIndicator: "high",
    trend: [40, 52, 61, 78, 90, 108, 120],
  },
  {
    batteryId: "B-3011",
    vehicleId: "V-4410",
    exposureHours: 85,
    highTempDurationHours: 9.2,
    eventCount: 3,
    riskIndicator: "medium",
    trend: [30, 38, 49, 58, 66, 74, 85],
  },
  {
    batteryId: "B-1092",
    vehicleId: "V-2931",
    exposureHours: 54,
    highTempDurationHours: 4.1,
    eventCount: 2,
    riskIndicator: "medium",
    trend: [12, 18, 24, 33, 41, 48, 54],
  },
];

export const forecasts: Forecast[] = [
  {
    vehicleId: "V-1042",
    currentTemperature: 58.2,
    predictedTemperature: 62.5,
    horizonMinutes: 10,
    confidenceInterval: [60.1, 64.9],
    timeToLimitMin: 8,
    limitC: 65,
    trend: [51, 53, 55, 56.5, 57.4, 58.2],
  },
  {
    vehicleId: "V-2931",
    currentTemperature: 49.1,
    predictedTemperature: 51.4,
    horizonMinutes: 15,
    confidenceInterval: [50.2, 52.8],
    timeToLimitMin: 42,
    limitC: 60,
    trend: [45, 46, 47, 48, 48.6, 49.1],
  },
];

export const events: ThermalEvent[] = [
  {
    id: "EVT-01",
    timestamp: "2026-09-10T04:18:00Z",
    vehicleId: "V-1042",
    batteryId: "B-8832",
    moduleId: "B-8832-M4",
    cellId: "B-8832-M4-C12",
    type: "Hotspot",
    severity: "critical",
    status: "open",
    confidence: 0.94,
    summary: "Localized heating in module 4, cell 12 with degraded cooling response.",
    metrics: { tmax: 58.2, tmin: 45.8, tavg: 49.1, deltaT: 12.4, dTdt: 0.45, unit: "°C" },
    sensorId: "S-102",
    coolingNote: "Observed cooling response −0.5°C/min vs expected −2.0°C/min.",
    recommendation: "Advisory: derate power to 50% and inspect cooling loop B.",
    trend: [46, 48, 51, 53, 55, 57, 58.2],
  },
  {
    id: "EVT-02",
    timestamp: "2026-09-10T03:52:00Z",
    vehicleId: "V-2931",
    batteryId: "B-1092",
    moduleId: "B-1092-M2",
    cellId: "B-1092-M2-C07",
    type: "Imbalance",
    severity: "warning",
    status: "acknowledged",
    confidence: 0.81,
    summary: "Module temperature spread exceeded watch threshold during climb load.",
    metrics: { tmax: 49.1, tmin: 38.4, tavg: 42.0, deltaT: 10.7, dTdt: 0.12, unit: "°C" },
    recommendation: "Monitor next duty cycle; schedule cooling inspection if ΔT persists.",
    trend: [42, 43, 44, 46, 47, 48, 49.1],
  },
  {
    id: "EVT-03",
    timestamp: "2026-09-09T21:10:00Z",
    vehicleId: "V-4410",
    batteryId: "B-3011",
    moduleId: "B-3011-M1",
    cellId: "B-3011-M1-C03",
    type: "Sensor residual",
    severity: "watch",
    status: "resolved",
    confidence: 0.66,
    summary: "Transient residual spike; later aligned with virtual estimate.",
    metrics: { tmax: 44.6, tmin: 36.2, tavg: 39.8, deltaT: 8.4, dTdt: 0.06, unit: "°C" },
    sensorId: "S-441",
    recommendation: "No action. Keep sensor on watch list.",
    trend: [39, 40, 41, 42, 43, 44, 44.6],
  },
];

export const maintenance: MaintenanceItem[] = [
  {
    id: "MNT-01",
    vehicleId: "V-1042",
    priority: "urgent",
    reason: "Persistent hotspot with cooling degradation",
    thermalIssue: "Module 4 hotspot + loop B restriction",
    recommendation: "Derate power to 50%; inspect cooling loop B before next shift.",
    severity: "critical",
    evidence: "Tmax 58.2°C, ΔT 12.4°C, cooling effectiveness 65% (demo).",
    status: "open",
  },
  {
    id: "MNT-02",
    vehicleId: "V-2931",
    priority: "high",
    reason: "Recurring thermal imbalance",
    thermalIssue: "Module 2 ΔT above watch band",
    recommendation: "Schedule pack inspection at next depot stop.",
    severity: "warning",
    evidence: "ΔT 10.7°C over 11 minutes (demo).",
    status: "scheduled",
  },
];

export const sensorConfig: SensorConfiguration = {
  currentSensors: 96,
  proposedSensors: 24,
  reductionPct: 75,
  reconstructionRmseC: 1.2,
  hotspotCoverage: 0.98,
  faultIsolation: "Successful on demo pack layout",
};

export const reports: ReportItem[] = [
  {
    id: "RPT-2201",
    type: "Fleet thermal daily",
    scope: "Global Fleet Ops",
    generatedAt: "2026-09-10T05:00:00Z",
    status: "ready",
    summary: "2 vehicles above warning; 1 urgent maintenance item.",
    reference: "DEMO-RPT-2201",
  },
  {
    id: "RPT-2194",
    type: "Hotspot evidence pack",
    scope: "V-1042 / B-8832",
    generatedAt: "2026-09-10T04:30:00Z",
    status: "ready",
    summary: "Module 4 cell 12 hotspot with cooling context.",
    reference: "DEMO-RPT-2194",
  },
  {
    id: "RPT-2188",
    type: "Sensor reduction study",
    scope: "Next-gen pack concept",
    generatedAt: "2026-09-09T16:00:00Z",
    status: "generating",
    summary: "Ablation study placeholder — model not implemented.",
    reference: "DEMO-RPT-2188",
  },
];

export const dashboardSummary: DashboardSummary = {
  demo: true,
  fleet: {
    totalVehicles: 1250,
    healthy: 1100,
    warning: 120,
    critical: 30,
    thermalRiskCount: 15,
    anomalyCount: anomalies.length,
  },
  vehiclesAtRisk: vehicles.filter((v) => v.thermalRisk === "critical" || v.thermalRisk === "warning"),
  anomalies,
  hotspot: hotspots[0],
  cooling: cooling[0],
  sensors: {
    healthy: 94,
    faulty: 2,
    items: sensors,
  },
  aging: { highExposureCount: 45, top: exposures },
  forecast: forecasts[0],
  maintenance,
  sensorReduction: sensorConfig,
  recentEvents: events,
};

export const demoDisclaimer = DEMO_NOTE;
