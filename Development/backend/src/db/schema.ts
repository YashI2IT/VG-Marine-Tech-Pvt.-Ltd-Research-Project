import { pgTable, serial, varchar, timestamp, text, primaryKey, integer, boolean, jsonb, doublePrecision } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 50 }).notNull().default("user"),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tenantUsers = pgTable("tenant_users", {
  tenantId: integer("tenant_id").references(() => tenants.id),
  userId: integer("user_id").references(() => users.id),
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
  status: varchar("status", { length: 50 }).notNull().default("QUEUED"),
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


// --- TRUSTSENSE-BMS PIPELINE & PROVENANCE MODELS ---

export const simulationSessions = pgTable("simulation_sessions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  datasetName: varchar("dataset_name", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("IDLE"),
  speed: doublePrecision("speed").default(1.0),
  totalSamples: integer("total_samples").default(0),
  processedSamples: integer("processed_samples").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const telemetryRecords = pgTable("telemetry_records", {
  id: varchar("id", { length: 255 }).primaryKey(),
  sessionId: varchar("session_id", { length: 255 }),
  recordIndex: integer("record_index").notNull(),
  sampleTime: doublePrecision("sample_time").notNull(),
  simulationTime: timestamp("simulation_time").notNull(),
  voltageV: doublePrecision("voltage_v").notNull(),
  currentA: doublePrecision("current_a").notNull(),
  ah: doublePrecision("ah").notNull(),
  chamberTempDegC: doublePrecision("chamber_temp_degc").notNull(),
  powerW: doublePrecision("power_w").notNull(),
  currentAbsA: doublePrecision("current_abs_a").notNull(),
  referenceTempDegC: doublePrecision("reference_temp_degc"),
  trustDecision: varchar("trust_decision", { length: 50 }).notNull().default("SAFE"),
  recordHash: varchar("record_hash", { length: 255 }).notNull(),
  batchId: varchar("batch_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const predictionRecords = pgTable("prediction_records", {
  id: varchar("id", { length: 255 }).primaryKey(),
  recordId: varchar("record_id", { length: 255 }),
  sessionId: varchar("session_id", { length: 255 }),
  windowId: varchar("window_id", { length: 255 }).notNull(),
  predictedTempDegC: doublePrecision("predicted_temp_degc").notNull(),
  referenceTempDegC: doublePrecision("reference_temp_degc"),
  residualDegC: doublePrecision("residual_degc"),
  absoluteErrorDegC: doublePrecision("absolute_error_degc"),
  latencyMs: doublePrecision("latency_ms"),
  modelVersion: varchar("model_version", { length: 50 }).notNull(),
  confidence: varchar("confidence", { length: 50 }).notNull().default("VALID"),
  oodStatus: varchar("ood_status", { length: 50 }).notNull().default("IN-DISTRIBUTION"),
  status: varchar("status", { length: 50 }).notNull().default("SUCCESS"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quarantinedRecords = pgTable("quarantined_records", {
  id: varchar("id", { length: 255 }).primaryKey(),
  sessionId: varchar("session_id", { length: 255 }),
  recordIndex: integer("record_index"),
  payload: jsonb("payload").notNull(),
  violationReasons: jsonb("violation_reasons").notNull(),
  trustDecision: varchar("trust_decision", { length: 50 }).notNull().default("BLOCK"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const merkleBatches = pgTable("merkle_batches", {
  id: varchar("id", { length: 255 }).primaryKey(),
  sessionId: varchar("session_id", { length: 255 }),
  batchIndex: integer("batch_index").notNull(),
  merkleRoot: varchar("merkle_root", { length: 255 }).notNull(),
  leafCount: integer("leaf_count").notNull(),
  startRecordId: varchar("start_record_id", { length: 255 }),
  endRecordId: varchar("end_record_id", { length: 255 }),
  leaves: jsonb("leaves").notNull(),
  treeStructure: jsonb("tree_structure"),
  s3ObjectKey: varchar("s3_object_key", { length: 512 }),
  status: varchar("status", { length: 50 }).notNull().default("COMMITTED"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ledgerAnchors = pgTable("ledger_anchors", {
  id: varchar("id", { length: 255 }).primaryKey(),
  batchId: varchar("batch_id", { length: 255 }),
  fabricTxId: varchar("fabric_tx_id", { length: 255 }).notNull(),
  blockNumber: integer("block_number").notNull(),
  merkleRoot: varchar("merkle_root", { length: 255 }).notNull(),
  channelId: varchar("channel_id", { length: 255 }).notNull().default("bmschannel"),
  chaincodeId: varchar("chaincode_id", { length: 255 }).notNull().default("trustsense-provenance"),
  anchorTimestamp: timestamp("anchor_timestamp").defaultNow().notNull(),
  status: varchar("status", { length: 50 }).notNull().default("CONFIRMED"),
  networkType: varchar("network_type", { length: 50 }).notNull().default("LOCAL_DEV_NETWORK"),
  verificationStatus: varchar("verification_status", { length: 50 }).notNull().default("VERIFIED"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const batteryPassports = pgTable("battery_passports", {
  id: varchar("id", { length: 255 }).primaryKey(),
  batteryId: varchar("battery_id", { length: 255 }).notNull().unique(),
  cellModel: varchar("cell_model", { length: 255 }).notNull(),
  chemistry: varchar("chemistry", { length: 100 }).notNull(),
  nominalCapacityAh: doublePrecision("nominal_capacity_ah").notNull(),
  nominalVoltageV: doublePrecision("nominal_voltage_v").notNull(),
  manufacturer: varchar("manufacturer", { length: 255 }).notNull(),
  manufactureDate: timestamp("manufacture_date").notNull(),
  totalCycles: integer("total_cycles").notNull().default(0),
  totalBatchesAnchored: integer("total_batches_anchored").notNull().default(0),
  latestMerkleRoot: varchar("latest_merkle_root", { length: 255 }),
  latestTxId: varchar("latest_tx_id", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull().default("ACTIVE"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
