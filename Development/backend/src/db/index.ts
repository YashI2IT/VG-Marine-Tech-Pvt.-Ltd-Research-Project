import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import * as dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("[PostgreSQL] DATABASE_URL environment variable is missing.");
}
const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
});

export const db = drizzle(pool, { schema });

/**
 * Validates connection to PostgreSQL and ensures schema tables are ready.
 */
export async function initDb(): Promise<void> {
  try {
    const client = await pool.connect();
    const res = await client.query("SELECT current_database(), current_user, version();");
    console.log(
      `[PostgreSQL] Connected to '${res.rows[0].current_database}' as '${res.rows[0].current_user}'`
    );

    // Ensure core tables exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tenant_users (
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (tenant_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS datasets (
        id VARCHAR(255) PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dataset_versions (
        id VARCHAR(255) PRIMARY KEY,
        dataset_id VARCHAR(255) REFERENCES datasets(id) ON DELETE CASCADE NOT NULL,
        version_tag VARCHAR(50) NOT NULL,
        s3_object_key VARCHAR(512) NOT NULL,
        checksum VARCHAR(255) NOT NULL,
        schema_version VARCHAR(50) NOT NULL,
        file_size INTEGER,
        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS processing_jobs (
        id VARCHAR(255) PRIMARY KEY,
        dataset_version_id VARCHAR(255) REFERENCES dataset_versions(id) ON DELETE CASCADE NOT NULL,
        model_version VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
        result_s3_key VARCHAR(512),
        metrics JSONB,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        completed_at TIMESTAMP
      );

      
      CREATE TABLE IF NOT EXISTS simulation_sessions (
        id VARCHAR(255) PRIMARY KEY,
        dataset_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'IDLE',
        speed DOUBLE PRECISION DEFAULT 1.0,
        total_samples INTEGER DEFAULT 0,
        processed_samples INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS telemetry_records (
        id VARCHAR(255) PRIMARY KEY,
        session_id VARCHAR(255),
        record_index INTEGER NOT NULL,
        sample_time DOUBLE PRECISION NOT NULL,
        simulation_time TIMESTAMP NOT NULL,
        voltage_v DOUBLE PRECISION NOT NULL,
        current_a DOUBLE PRECISION NOT NULL,
        ah DOUBLE PRECISION NOT NULL,
        chamber_temp_degc DOUBLE PRECISION NOT NULL,
        power_w DOUBLE PRECISION NOT NULL,
        current_abs_a DOUBLE PRECISION NOT NULL,
        reference_temp_degc DOUBLE PRECISION,
        trust_decision VARCHAR(50) NOT NULL DEFAULT 'SAFE',
        record_hash VARCHAR(255) NOT NULL,
        batch_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS prediction_records (
        id VARCHAR(255) PRIMARY KEY,
        record_id VARCHAR(255),
        session_id VARCHAR(255),
        window_id VARCHAR(255) NOT NULL,
        predicted_temp_degc DOUBLE PRECISION NOT NULL,
        reference_temp_degc DOUBLE PRECISION,
        residual_degc DOUBLE PRECISION,
        absolute_error_degc DOUBLE PRECISION,
        latency_ms DOUBLE PRECISION,
        model_version VARCHAR(50) NOT NULL,
        confidence VARCHAR(50) NOT NULL DEFAULT 'VALID',
        ood_status VARCHAR(50) NOT NULL DEFAULT 'IN-DISTRIBUTION',
        status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS quarantined_records (
        id VARCHAR(255) PRIMARY KEY,
        session_id VARCHAR(255),
        record_index INTEGER,
        payload JSONB NOT NULL,
        violation_reasons JSONB NOT NULL,
        trust_decision VARCHAR(50) NOT NULL DEFAULT 'BLOCK',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS merkle_batches (
        id VARCHAR(255) PRIMARY KEY,
        session_id VARCHAR(255),
        batch_index INTEGER NOT NULL,
        merkle_root VARCHAR(255) NOT NULL,
        leaf_count INTEGER NOT NULL,
        start_record_id VARCHAR(255),
        end_record_id VARCHAR(255),
        leaves JSONB NOT NULL,
        tree_structure JSONB,
        s3_object_key VARCHAR(512),
        status VARCHAR(50) NOT NULL DEFAULT 'COMMITTED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ledger_anchors (
        id VARCHAR(255) PRIMARY KEY,
        batch_id VARCHAR(255),
        fabric_tx_id VARCHAR(255) NOT NULL,
        block_number INTEGER NOT NULL,
        merkle_root VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL DEFAULT 'bmschannel',
        chaincode_id VARCHAR(255) NOT NULL DEFAULT 'trustsense-provenance',
        anchor_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'CONFIRMED',
        network_type VARCHAR(50) NOT NULL DEFAULT 'LOCAL_DEV_NETWORK',
        verification_status VARCHAR(50) NOT NULL DEFAULT 'VERIFIED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS battery_passports (
        id VARCHAR(255) PRIMARY KEY,
        battery_id VARCHAR(255) NOT NULL UNIQUE,
        cell_model VARCHAR(255) NOT NULL,
        chemistry VARCHAR(100) NOT NULL,
        nominal_capacity_ah DOUBLE PRECISION NOT NULL,
        nominal_voltage_v DOUBLE PRECISION NOT NULL,
        manufacturer VARCHAR(255) NOT NULL,
        manufacture_date TIMESTAMP NOT NULL,
        total_cycles INTEGER NOT NULL DEFAULT 0,
        total_batches_anchored INTEGER NOT NULL DEFAULT 0,
        latest_merkle_root VARCHAR(255),
        latest_tx_id VARCHAR(255),
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS provenance_records (
        event_id VARCHAR(255) PRIMARY KEY,
        job_id VARCHAR(255) REFERENCES processing_jobs(id) ON DELETE CASCADE,
        content_hash VARCHAR(255) NOT NULL,
        merkle_root VARCHAR(255),
        fabric_tx_id VARCHAR(255),
        verification_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    client.release();
    console.log("[PostgreSQL] All schema tables verified successfully.");
  } catch (err) {
    console.error("[PostgreSQL] Connection / initialization error:", err);
  }
}
