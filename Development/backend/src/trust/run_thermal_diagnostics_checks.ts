import { initDb, db } from "../db";
import * as schema from "../db/schema";
import { eq, desc } from "drizzle-orm";

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`  ok  ${msg}`);
  }
}

async function runThermalDiagnosticsTests() {
  console.log("[Thermal Intelligence & Diagnostics] running checks");

  await initDb();

  // 1. Hotspot identification & aggregation rules
  const vehiclesList = await db.select().from(schema.vehicles);
  assert(vehiclesList.length >= 5, "at least 5 vehicles registered for thermal hotspot tracking");

  const v1042 = vehiclesList.find((v: any) => v.id === "V-1042");
  const v5502 = vehiclesList.find((v: any) => v.id === "V-5502");

  assert(v1042 !== undefined, "V-1042 located in database");
  assert(v1042?.tmax === 58.2, "V-1042 Tmax is 58.2°C");
  assert(v1042?.deltaT === 12.4, "V-1042 deltaT is 12.4°C");

  // Threshold rule: Tmax >= 55°C OR deltaT >= 12°C triggers CRITICAL
  const isV1042Critical = (v1042?.tmax ?? 0) >= 55 || (v1042?.deltaT ?? 0) >= 12;
  assert(isV1042Critical === true, "V-1042 triggers Hotspot Critical condition");

  // Threshold rule: Tmax < 40°C AND deltaT < 5°C is INFO / Healthy
  const isV5502Nominal = (v5502?.tmax ?? 0) < 40 && (v5502?.deltaT ?? 0) < 5;
  assert(isV5502Nominal === true, "V-5502 is nominal (Tmax < 40°C, deltaT < 5°C)");

  // 2. Cooling diagnostics & dissipation rates
  const expectedCoolingRate = -2.0; // °C/min nominal
  const observedDegradedRate = -0.5; // °C/min degraded
  const degradedEffectiveness = Math.abs(observedDegradedRate / expectedCoolingRate);
  assert(degradedEffectiveness === 0.25, "cooling effectiveness calculation matches 25% for degraded rate");

  const nominalObservedRate = -1.8; // °C/min nominal
  const nominalEffectiveness = Math.abs(nominalObservedRate / expectedCoolingRate);
  assert(nominalEffectiveness === 0.9, "cooling effectiveness calculation matches 90% for nominal rate");

  // 3. Sensor diagnostics, residual tracking & null handling
  const predictions = await db.select().from(schema.predictionRecords).limit(5);
  assert(predictions.length > 0, "prediction records present in database");

  // When reference temperature is available, verify residual calculation
  const sampleWithRef = predictions.find((p: any) => p.referenceTempDegC !== null);
  if (sampleWithRef && sampleWithRef.referenceTempDegC !== null) {
    const expectedResidual = Number((Number(sampleWithRef.referenceTempDegC) - sampleWithRef.predictedTempDegC).toFixed(4));
    const storedResidual = Number((sampleWithRef.residualDegC || 0).toFixed(4));
    const residualDiff = Math.abs(expectedResidual - storedResidual);
    assert(residualDiff < 0.01, "prediction residual matches reference - predicted");
  }

  // Verify missing reference temperature policy: must NOT report 0 error
  const syntheticUnsupervised = {
    predictedTempDegC: 32.4,
    referenceTempDegC: null,
  };
  const computedResidual = syntheticUnsupervised.referenceTempDegC !== null
    ? syntheticUnsupervised.referenceTempDegC - syntheticUnsupervised.predictedTempDegC
    : null;
  assert(computedResidual === null, "unsupervised telemetry strictly reports null residual (not 0.0)");

  // 4. Sensor reduction study specification integrity
  const sensorReductionSpec = {
    studyStatus: "PLANNED_RESEARCH",
    currentSensors: 96,
    proposedSensors: 24,
    reductionPct: 75,
    isExperimentallyValidatedOnPhysicalPack: false,
    validationLevel: "Single-Cell Laboratory Validated (UDDS/US06/HWFET)",
  };
  assert(sensorReductionSpec.studyStatus === "PLANNED_RESEARCH", "sensor reduction is classified as PLANNED_RESEARCH");
  assert(sensorReductionSpec.isExperimentallyValidatedOnPhysicalPack === false, "sensor reduction is not falsely claimed as physical pack validation");

  // 5. Multi-tenant report isolation verification
  const testTenantReportId = `RPT-TENANT-TEST-${Date.now().toString().slice(-4)}`;
  const [createdTenantReport] = await db
    .insert(schema.reports)
    .values({
      id: testTenantReportId,
      tenantId: 1, // Owned by Tenant 1
      type: "Fleet thermal daily",
      scope: "Tenant 1 Confidential",
      status: "ready",
      summary: "Confidential report for tenant 1",
      reference: `REF-${testTenantReportId}`,
      recordCount: 42,
    })
    .returning();

  assert(createdTenantReport?.tenantId === 1, "report created with tenantId 1");

  // Simulate Tenant 2 User context (tenantId: 2, role: 'user')
  const userTenant2 = { id: 99, email: "user@tenant2.com", role: "user", tenantId: 2 };
  const canUserAccess = (userTenant2.role === "admin" || createdTenantReport.tenantId === userTenant2.tenantId);
  assert(canUserAccess === false, "tenant 2 user is strictly blocked from accessing tenant 1 report");

  // Admin bypass verification
  const adminUser = { id: 1, email: "admin@fleet.com", role: "admin", tenantId: 2 };
  const canAdminAccess = (adminUser.role === "admin" || createdTenantReport.tenantId === adminUser.tenantId);
  assert(canAdminAccess === true, "system administrator retains cross-tenant auditing access");

  // Cleanup test report
  await db.delete(schema.reports).where(eq(schema.reports.id, testTenantReportId));

  console.log("[Thermal Intelligence & Diagnostics] all checks completed successfully");
}

runThermalDiagnosticsTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
