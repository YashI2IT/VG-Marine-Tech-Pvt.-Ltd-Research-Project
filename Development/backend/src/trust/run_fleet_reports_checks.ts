import { initDb, db } from "../db";
import * as schema from "../db/schema";
import { eq, desc, count } from "drizzle-orm";

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`  ok  ${msg}`);
  }
}

async function runFleetAndReportsTests() {
  console.log("[Fleet, Vehicles & Reports] running checks");

  await initDb();

  // 1. Vehicles table initialization and seed verification
  const initialVehicles = await db.select().from(schema.vehicles);
  assert(initialVehicles.length >= 5, "at least 5 seeded vehicles in PostgreSQL database");
  const v1042 = initialVehicles.find((v: any) => v.id === "V-1042");
  assert(v1042 !== undefined, "V-1042 vehicle is present");
  assert(v1042?.batteryId === "BAT-PAN18650PF-001", "V-1042 is linked to BAT-PAN18650PF-001 passport");

  // 2. Vehicle creation lifecycle
  const testVehicleId = `V-TEST-${Date.now().toString().slice(-4)}`;
  const [createdVehicle] = await db
    .insert(schema.vehicles)
    .values({
      id: testVehicleId,
      tenantId: 1,
      name: "Test Transit Bus 99",
      fleet: "Harbor Express",
      status: "healthy",
      batteryId: "BAT-PAN18650PF-001",
      deviceId: "DEV-TEST-01",
      thermalRisk: "info",
      coolingHealth: "healthy",
      sensorHealth: "healthy",
      maintenancePriority: "low",
      location: "Depot Test",
      tmax: 28.5,
      tmin: 24.1,
      tavg: 26.3,
      deltaT: 4.4,
      dTdt: 0.05,
    })
    .returning();

  assert(createdVehicle?.id === testVehicleId, "vehicle created and returned from PostgreSQL");
  assert(createdVehicle?.name === "Test Transit Bus 99", "vehicle name preserved");

  // 3. Duplicate vehicle ID rejection
  let duplicateRejected = false;
  try {
    await db.insert(schema.vehicles).values({
      id: testVehicleId,
      tenantId: 1,
      name: "Duplicate Bus",
      fleet: "Harbor Express",
      status: "healthy",
      batteryId: "BAT-PAN18650PF-001",
    });
  } catch (err: any) {
    duplicateRejected = true;
  }
  assert(duplicateRejected === true, "duplicate vehicle primary key strictly rejected by PostgreSQL");

  // 4. Vehicle update lifecycle
  const [updatedVehicle] = await db
    .update(schema.vehicles)
    .set({
      status: "warning",
      thermalRisk: "warning",
      maintenancePriority: "high",
      updatedAt: new Date(),
    })
    .where(eq(schema.vehicles.id, testVehicleId))
    .returning();

  assert(updatedVehicle?.status === "warning", "vehicle status updated to warning");
  assert(updatedVehicle?.thermalRisk === "warning", "thermal risk updated to warning");
  assert(updatedVehicle?.maintenancePriority === "high", "maintenance priority updated to high");

  // 5. Work orders table verification & creation
  const initialOrders = await db.select().from(schema.workOrders);
  assert(initialOrders.length >= 3, "at least 3 initial work orders present in PostgreSQL");

  const testOrderId = `WO-TEST-${Date.now().toString().slice(-4)}`;
  const [createdOrder] = await db
    .insert(schema.workOrders)
    .values({
      id: testOrderId,
      tenantId: 1,
      vehicleId: testVehicleId,
      packId: "BAT-PAN18650PF-001",
      issue: "Elevated cell temperature during steep gradient climb",
      priority: "high",
      assignedTo: "Chief Engineer",
      status: "open",
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    })
    .returning();

  assert(createdOrder?.id === testOrderId, "work order persisted in PostgreSQL");
  assert(createdOrder?.status === "open", "work order initial status is open");

  // Update work order progression
  const [inProgressOrder] = await db
    .update(schema.workOrders)
    .set({ status: "in_progress", updatedAt: new Date() })
    .where(eq(schema.workOrders.id, testOrderId))
    .returning();

  assert(inProgressOrder?.status === "in_progress", "work order transitioned to in_progress");

  // 6. Reports table verification & generation from genuine records
  const initialReports = await db.select().from(schema.reports);
  assert(initialReports.length >= 2, "at least 2 seeded audit reports present");

  const [telCountRes, predCountRes, anchorCountRes] = await Promise.all([
    db.select({ count: count() }).from(schema.telemetryRecords),
    db.select({ count: count() }).from(schema.predictionRecords),
    db.select({ count: count() }).from(schema.ledgerAnchors),
  ]);

  const totalTelemetry = Number(telCountRes[0]?.count ?? 0);
  const totalPredictions = Number(predCountRes[0]?.count ?? 0);
  const totalAnchors = Number(anchorCountRes[0]?.count ?? 0);

  const testReportId = `RPT-TEST-${Date.now().toString().slice(-4)}`;
  const [generatedReport] = await db
    .insert(schema.reports)
    .values({
      id: testReportId,
      tenantId: 1,
      type: "Fleet thermal daily",
      scope: "Metro Fleet Ops",
      status: "ready",
      summary: `Automated test report reconciling ${totalTelemetry} telemetry records and ${totalPredictions} predictions.`,
      reference: `AUDIT-${testReportId}`,
      recordCount: totalTelemetry + totalPredictions,
      reportData: {
        totalTelemetry,
        totalPredictions,
        totalAnchors,
        testVehicleId,
      },
    })
    .returning();

  assert(generatedReport?.id === testReportId, "generated report saved to PostgreSQL");
  assert(generatedReport?.recordCount === totalTelemetry + totalPredictions, "report record count reconciles with database records");

  // 7. Report export structure
  const reportDataJson = JSON.stringify(generatedReport.reportData);
  assert(reportDataJson.includes("totalTelemetry"), "reportData JSONB structure contains telemetry counts");

  // 8. Cleanup test records
  await db.delete(schema.workOrders).where(eq(schema.workOrders.id, testOrderId));
  await db.delete(schema.reports).where(eq(schema.reports.id, testReportId));
  await db.delete(schema.vehicles).where(eq(schema.vehicles.id, testVehicleId));

  const [deletedVehicle] = await db.select().from(schema.vehicles).where(eq(schema.vehicles.id, testVehicleId));
  assert(deletedVehicle === undefined, "test vehicle successfully cleaned up after verification");

  console.log("[Fleet, Vehicles & Reports] all checks completed successfully");
}

runFleetAndReportsTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
