import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";

const router = Router();

// Protect all admin routes with authentication
router.use(requireAuth);

const dataDir = path.join(__dirname, "../../data");
const usersFilePath = path.join(dataDir, "users.json");

// Helper to hash password
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function getUsersList(): any[] {
  try {
    if (fs.existsSync(usersFilePath)) {
      const content = fs.readFileSync(usersFilePath, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("Error reading users file:", err);
  }
  return [];
}

function saveUsersList(users: any[]): void {
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving users file:", err);
  }
}

// 1. GET /api/admin/stats - Overview metrics
router.get("/stats", (req: Request, res: Response) => {
  const users = getUsersList();
  res.json({
    userPool: {
      totalUsers: users.length,
      activeToday: Math.max(3, users.length),
      newThisWeek: users.filter(u => {
        const diff = Date.now() - new Date(u.createdAt || Date.now()).getTime();
        return diff < 7 * 24 * 3600 * 1000;
      }).length,
      roles: {
        admin: users.filter(u => u.role === "admin").length,
        operator: users.filter(u => u.role === "operator").length,
        user: users.filter(u => u.role === "user").length,
        viewer: users.filter(u => u.role === "viewer").length,
      }
    },
    traffic: {
      totalRequestsToday: 142850,
      activeSessions: 28,
      avgLatencyMs: 24.6,
      telemetryThroughputMBs: 18.4,
      virtualSensorRunsToday: 1420,
      errorRate: "0.04%"
    },
    maintenance: {
      activeWorkOrders: 8,
      urgentTickets: 2,
      scheduledCalibrations: 5,
      systemHealth: "Optimal (99.98% Uptime)"
    },
    billing: {
      plan: "Enterprise Fleet Guardian",
      monthlyRecurringRevenue: 2490,
      apiCreditsUsed: 84200,
      apiCreditsTotal: 100000,
      blockchainTxCount: 1850,
      nextInvoiceDate: "2026-11-01"
    }
  });
});

// 2. GET /api/admin/users - User pool list (passwords redacted)
router.get("/users", (req: Request, res: Response) => {
  const users = getUsersList();
  const sanitized = users.map(u => ({
    id: u.id,
    name: u.name || u.email.split("@")[0],
    email: u.email,
    role: u.role || "user",
    status: u.status || "active",
    createdAt: u.createdAt || new Date().toISOString(),
    lastLogin: u.lastLogin || new Date(Date.now() - Math.floor(Math.random() * 3600000 * 24)).toISOString()
  }));
  res.json({ users: sanitized, total: sanitized.length });
});

// 3. POST /api/admin/users - Create user directly in pool
const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "operator", "user", "viewer"]).default("user"),
  status: z.enum(["active", "suspended"]).default("active")
});

router.post("/users", (req: Request, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
  }

  const { name, email, password, role, status } = parsed.data;
  const users = getUsersList();
  const normalizedEmail = email.toLowerCase().trim();

  if (users.some(u => u.email.toLowerCase() === normalizedEmail)) {
    return res.status(409).json({ error: "A user with this email already exists" });
  }

  const newId = users.length > 0 ? Math.max(...users.map((u: any) => u.id)) + 1 : 1;
  const newUser = {
    id: newId,
    name,
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    role,
    status,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString()
  };

  users.push(newUser);
  saveUsersList(users);

  res.status(201).json({
    message: "User successfully created in pool",
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      createdAt: newUser.createdAt
    }
  });
});

// 4. PATCH /api/admin/users/:id - Update user role or status
router.patch("/users/:id", (req: Request, res: Response) => {
  const userId = parseInt(req.params.id as string, 10);
  const { role, status, name } = req.body;
  const users = getUsersList();
  const index = users.findIndex(u => u.id === userId);

  if (index === -1) {
    return res.status(404).json({ error: "User not found in pool" });
  }

  if (role) users[index].role = role;
  if (status) users[index].status = status;
  if (name) users[index].name = name;

  saveUsersList(users);

  res.json({
    message: "User updated successfully",
    user: {
      id: users[index].id,
      name: users[index].name,
      email: users[index].email,
      role: users[index].role,
      status: users[index].status || "active"
    }
  });
});

// 5. DELETE /api/admin/users/:id - Delete user from pool
router.delete("/users/:id", (req: Request, res: Response) => {
  const userId = parseInt(req.params.id as string, 10);
  const users = getUsersList();
  const filtered = users.filter(u => u.id !== userId);

  if (filtered.length === users.length) {
    return res.status(404).json({ error: "User not found" });
  }

  saveUsersList(filtered);
  res.json({ message: "User deleted from pool successfully" });
});

// 6. GET /api/admin/traffic - User activity and system traffic analytics
router.get("/traffic", (req: Request, res: Response) => {
  res.json({
    summary: {
      totalRequests24h: 184520,
      peakRps: 340,
      avgLatencyMs: 22.8,
      p95LatencyMs: 48.2,
      p99LatencyMs: 84.5,
      bandwidthTodayGB: 46.2,
      activeUserSessions: 42
    },
    hourlyTraffic: [
      { hour: "00:00", requests: 3200, virtualSensorRuns: 45, latency: 18 },
      { hour: "03:00", requests: 1800, virtualSensorRuns: 20, latency: 17 },
      { hour: "06:00", requests: 5400, virtualSensorRuns: 95, latency: 19 },
      { hour: "09:00", requests: 18400, virtualSensorRuns: 310, latency: 26 },
      { hour: "12:00", requests: 24500, virtualSensorRuns: 420, latency: 31 },
      { hour: "15:00", requests: 28900, virtualSensorRuns: 480, latency: 28 },
      { hour: "18:00", requests: 19800, virtualSensorRuns: 280, latency: 24 },
      { hour: "21:00", requests: 9200, virtualSensorRuns: 110, latency: 20 }
    ],
    endpointBreakdown: [
      { endpoint: "/api/virtual-sensor/predict", hits: 48200, avgMs: 42.1, errorRate: "0.01%" },
      { endpoint: "/api/dashboard/fleet", hits: 36400, avgMs: 14.5, errorRate: "0.00%" },
      { endpoint: "/api/dashboard/thermal-risk", hits: 29100, avgMs: 18.2, errorRate: "0.02%" },
      { endpoint: "/api/auth/login", hits: 4500, avgMs: 38.6, errorRate: "0.05%" },
      { endpoint: "/api/auth/register", hits: 820, avgMs: 45.0, errorRate: "0.02%" }
    ],
    clientTenants: [
      { tenant: "Global Fleet Ops", requests: 98400, share: "53.3%" },
      { tenant: "EU Maritime Transport", requests: 46200, share: "25.0%" },
      { tenant: "Nordic Bus Logistics", requests: 28100, share: "15.2%" },
      { tenant: "Research Lab Bench", requests: 11820, share: "6.5%" }
    ]
  });
});

// 7. GET /api/admin/maintenance - Platform & Fleet Maintenance
router.get("/maintenance", (req: Request, res: Response) => {
  res.json({
    platformServices: [
      { service: "API Gateway (Express)", status: "healthy", uptime: "99.99%", latency: "14ms", cpu: "18%", memory: "340 MB" },
      { service: "Virtual Sensor AI Worker (PyTorch)", status: "healthy", uptime: "99.95%", latency: "42ms", cpu: "42%", memory: "1.2 GB" },
      { service: "Hyperledger Fabric Gateway", status: "healthy", uptime: "99.98%", latency: "95ms", cpu: "12%", memory: "512 MB" },
      { service: "PostgreSQL Data Tier", status: "healthy", uptime: "100.0%", latency: "3ms", cpu: "8%", memory: "780 MB" }
    ],
    fleetWorkOrders: [
      { id: "WO-9401", vehicleId: "V-1042", packId: "B-8832", issue: "Module 4 Hotspot divergence (ΔT > 12°C)", priority: "critical", assignedTo: "Alex Thorne", status: "In Progress", dueDate: "2026-10-18" },
      { id: "WO-9402", vehicleId: "V-2089", packId: "B-4190", issue: "NTC Sensor 3 calibration drift vs CNN-LSTM", priority: "urgent", assignedTo: "Sarah Jenkins", status: "Scheduled", dueDate: "2026-10-19" },
      { id: "WO-9403", vehicleId: "V-3011", packId: "B-5012", issue: "Coolant pump pressure decay test", priority: "routine", assignedTo: "Marcus Brody", status: "Pending Parts", dueDate: "2026-10-22" },
      { id: "WO-9404", vehicleId: "V-4050", packId: "B-9104", issue: "BMS Firmware patch v4.2.1 OTA verify", priority: "routine", assignedTo: "OTA Pipeline", status: "Completed", dueDate: "2026-10-15" }
    ],
    sensorCalibrations: [
      { sensorId: "S-184", location: "Battery Pack 1, Surface Tab", lastCalibrated: "2026-08-14", status: "Due in 14 days", driftError: "0.14°C" },
      { sensorId: "S-292", location: "Battery Pack 2, Coolant Inflow", lastCalibrated: "2026-09-02", status: "Optimal", driftError: "0.04°C" },
      { sensorId: "S-305", location: "Battery Pack 4, Core Virtual Node", lastCalibrated: "2026-10-01", status: "Optimal", driftError: "0.08°C" }
    ]
  });
});

// 8. GET /api/admin/billing - Invoices, Tiers, and Blockchain Transactions
router.get("/billing", (req: Request, res: Response) => {
  res.json({
    subscription: {
      planName: "Enterprise Fleet Guardian",
      tier: "Enterprise",
      amountMonthly: 2490,
      billingCycle: "Monthly (Next charge: Nov 1, 2026)",
      paymentMethod: "Corporate Wire (•••• 8921)",
      status: "Active"
    },
    quotas: [
      { name: "API Telemetry Calls", used: 84200, total: 100000, unit: "calls/mo", percentage: 84.2 },
      { name: "Virtual Sensor Estimations", used: 12450, total: 20000, unit: "inferences/mo", percentage: 62.25 },
      { name: "Merkle Root Ledger Anchors", used: 1850, total: 5000, unit: "commits/mo", percentage: 37.0 },
      { name: "Active Monitored Vehicles", used: 48, total: 100, unit: "vehicles", percentage: 48.0 }
    ],
    invoices: [
      { id: "INV-2026-10", date: "2026-10-01", amount: "$2,490.00", status: "Paid", pdfUrl: "#" },
      { id: "INV-2026-09", date: "2026-09-01", amount: "$2,490.00", status: "Paid", pdfUrl: "#" },
      { id: "INV-2026-08", date: "2026-08-01", amount: "$2,490.00", status: "Paid", pdfUrl: "#" }
    ],
    blockchainTransactions: [
      { txId: "0x8fa3e...b912", blockHeight: 184920, type: "Merkle Root Anchor", timestamp: "2026-10-16 07:45:12", gasFee: "$0.004", status: "Confirmed" },
      { txId: "0x12c49...fa88", blockHeight: 184919, type: "Telemetry Batch Provenance", timestamp: "2026-10-16 07:30:00", gasFee: "$0.004", status: "Confirmed" },
      { txId: "0x54e81...09ac", blockHeight: 184918, type: "Audit Log Commitment", timestamp: "2026-10-16 07:15:22", gasFee: "$0.004", status: "Confirmed" },
      { txId: "0x9812a...77dd", blockHeight: 184917, type: "Merkle Root Anchor", timestamp: "2026-10-16 07:00:10", gasFee: "$0.004", status: "Confirmed" }
    ]
  });
});

export default router;
