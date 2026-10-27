import { db } from "../src/db";
import * as schema from "../src/db/schema";
import { count } from "drizzle-orm";

async function main() {
  const [u] = await db.select({ n: count() }).from(schema.users);
  const [t] = await db.select({ n: count() }).from(schema.tenants);
  const [tu] = await db.select({ n: count() }).from(schema.tenantUsers);
  const [cp] = await db.select({ n: count() }).from(schema.companyProfiles);
  const [v] = await db.select({ n: count() }).from(schema.vehicles);
  const [wo] = await db.select({ n: count() }).from(schema.workOrders);
  const [tel] = await db.select({ n: count() }).from(schema.telemetryRecords);
  const [pred] = await db.select({ n: count() }).from(schema.predictionRecords);
  const [mb] = await db.select({ n: count() }).from(schema.merkleBatches);
  const [la] = await db.select({ n: count() }).from(schema.ledgerAnchors);
  const [sub] = await db.select({ n: count() }).from(schema.subscriptions);
  const [inv] = await db.select({ n: count() }).from(schema.billingInvoices);
  const [bo] = await db.select({ n: count() }).from(schema.billingOrders);

  console.log("DB_AUDIT_COUNTS:", JSON.stringify({
    users: u?.n,
    tenants: t?.n,
    tenantUsers: tu?.n,
    companyProfiles: cp?.n,
    vehicles: v?.n,
    workOrders: wo?.n,
    telemetry: tel?.n,
    predictions: pred?.n,
    batches: mb?.n,
    anchors: la?.n,
    subscriptions: sub?.n,
    invoices: inv?.n,
    billingOrders: bo?.n,
  }, null, 2));

  // Inspect users
  const userList = await db.select({ id: schema.users.id, email: schema.users.email, role: schema.users.role, status: schema.users.status }).from(schema.users);
  console.log("USERS_SAMPLE:", JSON.stringify(userList, null, 2));

  // Inspect work orders
  const woList = await db.select().from(schema.workOrders);
  console.log("WORK_ORDERS_SAMPLE:", JSON.stringify(woList, null, 2));

  // Inspect subscriptions and invoices
  const subList = await db.select().from(schema.subscriptions);
  console.log("SUBSCRIPTIONS_SAMPLE:", JSON.stringify(subList, null, 2));

  const invList = await db.select().from(schema.billingInvoices);
  console.log("INVOICES_SAMPLE:", JSON.stringify(invList, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error("DB error:", err);
  process.exit(1);
});
