import { pgTable, serial, varchar, timestamp, text, primaryKey, integer, boolean, jsonb } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 50 }).notNull().default("viewer"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tenantUsers = pgTable("tenant_users", {
  tenantId: serial("tenant_id").references(() => tenants.id),
  userId: serial("user_id").references(() => users.id),
}, (t) => ({
  pk: primaryKey({ columns: [t.tenantId, t.userId] })
}));

// --- CLOUD PLATFORM MODELS ---

export const datasets = pgTable("datasets", {
  id: varchar("id", { length: 255 }).primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const datasetVersions = pgTable("dataset_versions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  datasetId: varchar("dataset_id", { length: 255 }).references(() => datasets.id).notNull(),
  versionTag: varchar("version_tag", { length: 50 }).notNull(),
  s3ObjectKey: varchar("s3_object_key", { length: 512 }).notNull(),
  checksum: varchar("checksum", { length: 255 }).notNull(), // SHA-256
  schemaVersion: varchar("schema_version", { length: 50 }).notNull(),
  fileSize: integer("file_size"),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const processingJobs = pgTable("processing_jobs", {
  id: varchar("id", { length: 255 }).primaryKey(),
  datasetVersionId: varchar("dataset_version_id", { length: 255 }).references(() => datasetVersions.id).notNull(),
  modelVersion: varchar("model_version", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("QUEUED"), // UPLOADED, VALIDATING, QUEUED, PROCESSING, COMPLETED, FAILED
  resultS3Key: varchar("result_s3_key", { length: 512 }),
  metrics: jsonb("metrics"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const provenanceRecords = pgTable("provenance_records", {
  eventId: varchar("event_id", { length: 255 }).primaryKey(),
  jobId: varchar("job_id", { length: 255 }).references(() => processingJobs.id),
  contentHash: varchar("content_hash", { length: 255 }).notNull(),
  merkleRoot: varchar("merkle_root", { length: 255 }),
  fabricTxId: varchar("fabric_tx_id", { length: 255 }),
  verificationStatus: varchar("verification_status", { length: 50 }).notNull().default("PENDING"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
