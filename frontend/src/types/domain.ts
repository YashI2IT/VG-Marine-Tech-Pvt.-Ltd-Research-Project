export type Severity = "info" | "watch" | "warning" | "critical";
export type HealthStatus = "healthy" | "watch" | "warning" | "critical" | "degraded" | "faulty";
export type EventStatus = "open" | "acknowledged" | "resolved";
export type MaintenanceStatus = "open" | "scheduled" | "in_progress" | "closed";
export type SensorFaultType = "none" | "stuck-at" | "bias" | "drift" | "noisy";
export type ReportStatus = "ready" | "generating" | "failed";

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

export interface Tenant {
  id: string;
  name: string;
}

export interface ThermalMetric {
  tmax: number;
  tmin: number;
  tavg: number;
  deltaT: number;
  dTdt: number;
  unit: "°C";
}

export interface Vehicle {
  id: string;
  name: string;
  fleet: string;
  status: HealthStatus;
  batteryId: string;
  thermalRisk: Severity;
  coolingHealth: HealthStatus;
  sensorHealth: HealthStatus;
  lastUpdate: string;
  maintenancePriority: "low" | "medium" | "high" | "urgent";
  metrics: ThermalMetric;
  location: string;
}

export interface Cell {
  id: string;
  moduleId: string;
  index: number;
  physicalTemp: number;
  virtualTemp: number;
  isHotspot: boolean;
  status: HealthStatus;
}

export interface Module {
  id: string;
  batteryId: string;
  name: string;
  rows: number;
  cols: number;
  cells: Cell[];
  metrics: ThermalMetric;
}

export interface Battery {
  id: string;
  vehicleId: string;
  chemistry: string;
  capacityKwh: number;
  modules: Module[];
  metrics: ThermalMetric;
  coolingLoop: string;
}

export interface ThermalAnomaly {
  id: string;
  vehicleId: string;
  batteryId: string;
  moduleId: string;
  cellId: string;
  type: string;
  severity: Severity;
  temperature: number;
  confidence: number;
  timestamp: string;
}

export interface Hotspot {
  id: string;
  vehicleId: string;
  batteryId: string;
  moduleId: string;
  cellId: string;
  temperature: number;
  tmax: number;
  deltaT: number;
  dTdt: number;
  severity: Severity;
  confidence: number;
  detectedAt: string;
  persistenceMin: number;
  trend: number[];
}

export interface CoolingHealth {
  vehicleId: string;
  status: HealthStatus;
  effectiveness: number;
  expectedResponse: number;
  observedResponse: number;
  coolantInletC: number;
  coolantOutletC: number;
  issues: string[];
  confidence: number;
  relatedEventIds: string[];
}

export interface SensorHealth {
  id: string;
  vehicleId: string;
  location: string;
  physicalValue: number;
  virtualValue: number;
  residual: number;
  status: HealthStatus;
  faultType: SensorFaultType;
  confidence: number;
  lastUpdate: string;
}

export interface ThermalExposure {
  batteryId: string;
  vehicleId: string;
  exposureHours: number;
  highTempDurationHours: number;
  eventCount: number;
  riskIndicator: "low" | "medium" | "high";
  trend: number[];
}

export interface Forecast {
  vehicleId: string;
  currentTemperature: number;
  predictedTemperature: number;
  horizonMinutes: number;
  confidenceInterval: [number, number];
  timeToLimitMin: number | null;
  limitC: number;
  trend: number[];
}

export interface ThermalEvent {
  id: string;
  timestamp: string;
  vehicleId: string;
  batteryId: string;
  moduleId: string;
  cellId: string;
  type: string;
  severity: Severity;
  status: EventStatus;
  confidence: number;
  summary: string;
  metrics: ThermalMetric;
  sensorId?: string;
  coolingNote?: string;
  recommendation: string;
  trend: number[];
}

export interface MaintenanceItem {
  id: string;
  vehicleId: string;
  priority: "low" | "medium" | "high" | "urgent";
  reason: string;
  thermalIssue: string;
  recommendation: string;
  severity: Severity;
  evidence: string;
  status: MaintenanceStatus;
}

export interface SensorConfiguration {
  currentSensors: number;
  proposedSensors: number;
  reductionPct: number;
  reconstructionRmseC: number;
  hotspotCoverage: number;
  faultIsolation: string;
}

export interface ReportItem {
  id: string;
  type: string;
  scope: string;
  generatedAt: string;
  status: ReportStatus;
  summary: string;
  reference: string;
}

export interface TimePoint {
  t: string;
  value: number;
  upper?: number;
  lower?: number;
}

export interface DashboardSummary {
  demo: true;
  fleet: {
    totalVehicles: number;
    healthy: number;
    warning: number;
    critical: number;
    thermalRiskCount: number;
    anomalyCount: number;
  };
  vehiclesAtRisk: Vehicle[];
  anomalies: ThermalAnomaly[];
  hotspot: Hotspot;
  cooling: CoolingHealth;
  sensors: { healthy: number; faulty: number; items: SensorHealth[] };
  aging: { highExposureCount: number; top: ThermalExposure[] };
  forecast: Forecast;
  maintenance: MaintenanceItem[];
  sensorReduction: SensorConfiguration;
  recentEvents: ThermalEvent[];
}
