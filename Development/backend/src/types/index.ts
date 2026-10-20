/**
 * Domain Type Definitions for ECUlytics Backend Services
 */

export type UserRole = 'admin' | 'operator' | 'analyst' | 'viewer';
export type UserStatus = 'active' | 'suspended' | 'pending';

export interface UserRecord {
  id: string;
  email: string;
  password?: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLoginAt?: string;
  organization?: string;
}

export interface AuthSession {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface AdminTrafficSummary {
  hourlyTraffic: Array<{ time: string; requests: number; errorRate: number; latencyMs: number }>;
  routeDistribution: Array<{ route: string; calls: number; percentage: number }>;
  activeConnections: number;
  peakRps: number;
  avgLatencyMs: number;
  uptimeSeconds: number;
}

export interface MaintenanceTask {
  id: string;
  vehicleId: string;
  batteryPackId: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'scheduled';
  scheduledDate: string;
  technicianNotes?: string;
}

export interface BillingTransaction {
  id: string;
  organizationId: string;
  organizationName: string;
  tier: 'starter' | 'pro' | 'enterprise';
  amount: number;
  currency: string;
  date: string;
  status: 'paid' | 'pending' | 'failed';
  invoiceUrl?: string;
}

export interface VirtualSensorPrediction {
  timestamp: string;
  cellTemperatureEst: number;
  moduleGradientEst: number;
  confidenceScore: number;
  anomalyDetected: boolean;
  warnings?: string[];
}
