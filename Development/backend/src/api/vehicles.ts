import { Router, Request, Response } from "express";
import { z } from "zod";
import { eq, desc, and, or, ilike } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

// Protect all vehicle endpoints with authentication
router.use(requireAuth);

const vehicleInputSchema = z.object({
  id: z.string().min(2, "Vehicle ID must be at least 2 characters").regex(/^[A-Za-z0-9_-]+$/, "ID may only contain letters, numbers, dashes, underscores"),
  name: z.string().min(2, "Vehicle name must be at least 2 characters"),
  fleet: z.string().min(2, "Fleet name must be at least 2 characters").default("Metro North"),
  status: z.enum(["healthy", "watch", "warning", "critical", "degraded", "faulty"]).default("healthy"),
  batteryId: z.string().min(2, "Battery ID is required"),
  deviceId: z.string().optional(),
  thermalRisk: z.enum(["info", "watch", "warning", "critical"]).default("info"),
  coolingHealth: z.enum(["healthy", "watch", "warning", "critical", "degraded", "faulty"]).default("healthy"),
  sensorHealth: z.enum(["healthy", "watch", "warning", "critical", "degraded", "faulty"]).default("healthy"),
  maintenancePriority: z.enum(["low", "medium", "high", "urgent"]).default("low"),
  location: z.string().default("Depot A"),
  tmax: z.number().default(25.0),
  tmin: z.number().default(24.0),
  tavg: z.number().default(24.5),
  deltaT: z.number().default(1.0),
  dTdt: z.number().default(0.0),
});

const vehicleUpdateSchema = vehicleInputSchema.partial().omit({ id: true });

function formatVehicle(v: typeof schema.vehicles.$inferSelect) {
  return {
    id: v.id,
    name: v.name,
    fleet: v.fleet,
    status: v.status as any,
    batteryId: v.batteryId,
    deviceId: v.deviceId,
    thermalRisk: v.thermalRisk as any,
    coolingHealth: v.coolingHealth as any,
    sensorHealth: v.sensorHealth as any,
    lastUpdate: v.lastUpdate ? new Date(v.lastUpdate).toISOString() : new Date().toISOString(),
    maintenancePriority: v.maintenancePriority as any,
    location: v.location,
    metrics: {
      tmax: v.tmax,
      tmin: v.tmin,
      tavg: v.tavg,
      deltaT: v.deltaT,
      dTdt: v.dTdt,
      unit: "°C" as const,
    },
  };
}

// 1. GET /api/vehicles - List all vehicles with tenant scoping
router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, fleet, search } = req.query;
    const user = (req as any).user;

    const allVehicles = await db
      .select()
      .from(schema.vehicles)
      .orderBy(desc(schema.vehicles.id));

    let filtered = allVehicles;
    // Enforce tenant boundary for non-admin users
    if (user?.role !== "admin" && user?.tenantId) {
      filtered = filtered.filter((v) => !v.tenantId || v.tenantId === user.tenantId);
    }

    if (status && typeof status === "string") {
      filtered = filtered.filter((v) => v.status === status);
    }
    if (fleet && typeof fleet === "string") {
      filtered = filtered.filter((v) => v.fleet.toLowerCase() === fleet.toLowerCase());
    }
    if (search && typeof search === "string") {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.id.toLowerCase().includes(q) ||
          v.name.toLowerCase().includes(q) ||
          v.location.toLowerCase().includes(q)
      );
    }

    res.json(filtered.map(formatVehicle));
  } catch (err) {
    console.error("Error fetching vehicles:", err);
    res.status(500).json({ error: "Failed to list vehicles from database" });
  }
});

// 2. GET /api/vehicles/:id - Get single vehicle detail with tenant verification
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const vehicleId = req.params.id as string;
    const [vehicle] = await db
      .select()
      .from(schema.vehicles)
      .where(eq(schema.vehicles.id, vehicleId))
      .limit(1);

    if (!vehicle) {
      return res.status(404).json({ error: `Vehicle '${vehicleId}' not found` });
    }

    const user = (req as any).user;
    if (user && user.role !== "admin" && vehicle.tenantId && user.tenantId && vehicle.tenantId !== user.tenantId) {
      return res.status(403).json({ error: "Forbidden: Access denied to vehicle belonging to another tenant" });
    }

    res.json(formatVehicle(vehicle));
  } catch (err) {
    console.error("Error retrieving vehicle:", err);
    res.status(500).json({ error: "Failed to load vehicle" });
  }
});

// 3. POST /api/vehicles - Create vehicle record
router.post("/", async (req: Request, res: Response) => {
  const parsed = vehicleInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || "Invalid vehicle data",
      details: parsed.error.issues,
    });
  }

  const data = parsed.data;

  try {
    const [existing] = await db
      .select()
      .from(schema.vehicles)
      .where(eq(schema.vehicles.id, data.id))
      .limit(1);

    if (existing) {
      return res.status(409).json({ error: `Vehicle with ID '${data.id}' already exists` });
    }

    const [created] = await db
      .insert(schema.vehicles)
      .values({
        id: data.id,
        tenantId: (req as any).user?.tenantId || 1,
        name: data.name,
        fleet: data.fleet,
        status: data.status,
        batteryId: data.batteryId,
        deviceId: data.deviceId,
        thermalRisk: data.thermalRisk,
        coolingHealth: data.coolingHealth,
        sensorHealth: data.sensorHealth,
        maintenancePriority: data.maintenancePriority,
        location: data.location,
        tmax: data.tmax,
        tmin: data.tmin,
        tavg: data.tavg,
        deltaT: data.deltaT,
        dTdt: data.dTdt,
      })
      .returning();

    res.status(201).json(formatVehicle(created));
  } catch (err) {
    console.error("Error creating vehicle:", err);
    res.status(500).json({ error: "Failed to persist vehicle" });
  }
});

// 4. PATCH /api/vehicles/:id - Update vehicle record
router.patch("/:id", async (req: Request, res: Response) => {
  const vehicleId = req.params.id as string;
  const parsed = vehicleUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || "Invalid update payload",
      details: parsed.error.issues,
    });
  }

  try {
    const [existing] = await db
      .select()
      .from(schema.vehicles)
      .where(eq(schema.vehicles.id, vehicleId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: `Vehicle '${vehicleId}' not found` });
    }

    const user = (req as any).user;
    if (user && user.role !== "admin" && existing.tenantId && user.tenantId && existing.tenantId !== user.tenantId) {
      return res.status(403).json({ error: "Forbidden: Access denied to update vehicle belonging to another tenant" });
    }

    const updates: Partial<typeof schema.vehicles.$inferInsert> = {
      ...parsed.data,
      updatedAt: new Date(),
      lastUpdate: new Date(),
    };

    const [updated] = await db
      .update(schema.vehicles)
      .set(updates)
      .where(eq(schema.vehicles.id, vehicleId))
      .returning();

    res.json(formatVehicle(updated));
  } catch (err) {
    console.error("Error updating vehicle:", err);
    res.status(500).json({ error: "Failed to update vehicle" });
  }
});

// 5. DELETE /api/vehicles/:id - Delete vehicle (Admin only)
router.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  const vehicleId = req.params.id as string;

  try {
    const user = (req as any).user;
    const [existing] = await db
      .select()
      .from(schema.vehicles)
      .where(eq(schema.vehicles.id, vehicleId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: `Vehicle '${vehicleId}' not found` });
    }

    if (user && user.role !== "admin" && existing.tenantId && user.tenantId && existing.tenantId !== user.tenantId) {
      return res.status(403).json({ error: "Forbidden: Access denied to delete vehicle belonging to another tenant" });
    }

    const [deleted] = await db
      .delete(schema.vehicles)
      .where(eq(schema.vehicles.id, vehicleId))
      .returning();

    res.json({ message: `Vehicle '${vehicleId}' deleted successfully` });
  } catch (err) {
    console.error("Error deleting vehicle:", err);
    res.status(500).json({ error: "Failed to delete vehicle" });
  }
});

export default router;
