import { api } from "@/lib/api";

export interface AdminStats {
  userPool: {
    totalUsers: number;
    activeToday: number;
    newThisWeek: number;
    roles: {
      admin: number;
      operator: number;
      user: number;
      viewer: number;
    };
  };
  traffic: {
    totalRequestsToday: number;
    activeSessions: number;
    avgLatencyMs: number;
    telemetryThroughputMBs: number;
    virtualSensorRunsToday: number;
    errorRate: string;
  };
  maintenance: {
    activeWorkOrders: number;
    urgentTickets: number;
    scheduledCalibrations: number;
    systemHealth: string;
  };
  billing: {
    plan: string;
    monthlyRecurringRevenue: number;
    apiCreditsUsed: number;
    apiCreditsTotal: number;
    blockchainTxCount: number;
    nextInvoiceDate: string;
  };
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "operator" | "user" | "viewer";
  status: "active" | "suspended";
  createdAt: string;
  lastLogin?: string;
}

export interface TrafficAnalytics {
  summary: {
    totalRequests24h: number;
    peakRps: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    bandwidthTodayGB: number;
    activeUserSessions: number;
  };
  hourlyTraffic: {
    hour: string;
    requests: number;
    virtualSensorRuns: number;
    latency: number;
  }[];
  endpointBreakdown: {
    endpoint: string;
    hits: number;
    avgMs: number;
    errorRate: string;
  }[];
  clientTenants: {
    tenant: string;
    requests: number;
    share: string;
  }[];
}

export interface MaintenanceData {
  platformServices: {
    service: string;
    status: string;
    uptime: string;
    latency: string;
    cpu: string;
    memory: string;
  }[];
  fleetWorkOrders: {
    id: string;
    vehicleId: string;
    packId: string;
    issue: string;
    priority: "critical" | "urgent" | "routine";
    assignedTo: string;
    status: string;
    dueDate: string;
  }[];
  sensorCalibrations: {
    sensorId: string;
    location: string;
    lastCalibrated: string;
    status: string;
    driftError: string;
  }[];
}

export interface BillingData {
  subscription: {
    planName: string;
    tier: string;
    amountMonthly: number;
    billingCycle: string;
    paymentMethod: string;
    status: string;
  };
  quotas: {
    name: string;
    used: number;
    total: number;
    unit: string;
    percentage: number;
  }[];
  invoices: {
    id: string;
    date: string;
    amount: string;
    status: string;
    pdfUrl: string;
  }[];
  blockchainTransactions: {
    txId: string;
    blockHeight: number;
    type: string;
    timestamp: string;
    gasFee: string;
    status: string;
  }[];
}

export async function getAdminStats(): Promise<AdminStats> {
  const { data } = await api.get<AdminStats>("/admin/stats");
  return data;
}

export async function getAdminUsers(): Promise<{ users: AdminUser[]; total: number }> {
  const { data } = await api.get<{ users: AdminUser[]; total: number }>("/admin/users");
  return data;
}

export async function createAdminUser(payload: {
  name: string;
  email: string;
  password: string;
  role?: string;
  status?: string;
}): Promise<{ message: string; user: AdminUser }> {
  const { data } = await api.post<{ message: string; user: AdminUser }>("/admin/users", payload);
  return data;
}

export async function updateAdminUser(
  id: number,
  payload: { role?: string; status?: string; name?: string }
): Promise<{ message: string; user: AdminUser }> {
  const { data } = await api.patch<{ message: string; user: AdminUser }>(`/admin/users/${id}`, payload);
  return data;
}

export async function deleteAdminUser(id: number): Promise<{ message: string }> {
  const { data } = await api.delete<{ message: string }>(`/admin/users/${id}`);
  return data;
}

export async function getAdminTraffic(): Promise<TrafficAnalytics> {
  const { data } = await api.get<TrafficAnalytics>("/admin/traffic");
  return data;
}

export async function getAdminMaintenance(): Promise<MaintenanceData> {
  const { data } = await api.get<MaintenanceData>("/admin/maintenance");
  return data;
}

export async function getAdminBilling(): Promise<BillingData> {
  const { data } = await api.get<BillingData>("/admin/billing");
  return data;
}
