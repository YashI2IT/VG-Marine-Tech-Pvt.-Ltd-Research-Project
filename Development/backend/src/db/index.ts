import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString =
  process.env.DATABASE_URL || "postgres://postgres:Ypb%40192576@localhost:5432/eculytics";

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
